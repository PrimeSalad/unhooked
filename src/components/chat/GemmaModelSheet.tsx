import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, useWindowDimensions, View } from 'react-native';

import {
  getAndroidRuntimeStatus,
  hasAndroidLocalAiRuntime,
  inspectAndroidDevice,
  setAndroidPerformanceMode,
  startAndroidLocalModel,
  warmAndroidLocalModel,
} from '@/ai/androidLocalAi';
import {
  formatModelStorage,
  LOCAL_MODEL_BY_ID,
  LOCAL_MODELS,
  modelUri,
  recommendLocalModel,
  STORAGE_HEADROOM,
  type AndroidDeviceProfile,
  type LocalModelChoice,
  type LocalModelId,
  type PerformanceMode,
} from '@/ai/localModels';
import {
  cancelModelDownload,
  readPartialProgress,
  startModelDownload,
  useModelDownloads,
} from '@/ai/modelDownloads';
import { Button, IconButton, ProgressBar, Segmented, Sheet, Text } from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { useSettings } from '@/store/settings';

const PERFORMANCE_OPTIONS: { value: PerformanceMode; label: string }[] = [
  { value: 'balanced', label: 'Balanced' },
  { value: 'max', label: 'Max' },
];

const PROFILE_GROUPS = [
  {
    title: 'Text-only',
    ids: ['qwen3-0.6b', 'qwen2.5-1.5b'] as LocalModelId[],
  },
  {
    title: 'Text + vision',
    ids: ['gemma4-e2b', 'gemma4-e4b'] as LocalModelId[],
  },
];

type RuntimeStatus = {
  ready: boolean;
  backend: string | null;
  backendNote: string | null;
  modelPath: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  modelChoice: LocalModelChoice;
  onModelChoiceChange: (choice: LocalModelChoice) => void;
  onBackendChange: (backend: string | null) => void;
};

const emptyInstalled = (): Record<LocalModelId, boolean> => ({
  'qwen3-0.6b': false,
  'qwen2.5-1.5b': false,
  'gemma4-e2b': false,
  'gemma4-e4b': false,
});

const formatRam = (bytes?: number | null) => (bytes ? `${(bytes / 1_000_000_000).toFixed(1)} GB` : 'Unknown');

export function GemmaModelSheet({
  visible,
  onClose,
  modelChoice,
  onModelChoiceChange,
  onBackendChange,
}: Props) {
  const { height } = useWindowDimensions();
  const profileListMaxHeight = Math.max(140, height - 140);
  const [device, setDevice] = useState<AndroidDeviceProfile | null>(null);
  const [installed, setInstalled] = useState<Record<LocalModelId, boolean>>(emptyInstalled);
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
  const download = useModelDownloads((s) => s.active);
  const downloadError = useModelDownloads((s) => s.error);
  const completedDownload = useModelDownloads((s) => s.completed);
  const [partial, setPartial] = useState<Partial<Record<LocalModelId, number>>>({});
  const [startingModelId, setStartingModelId] = useState<LocalModelId | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const performance = useSettings((s) => s.localAiPerformance);
  const setLocalAiPerformance = useSettings((s) => s.setLocalAiPerformance);
  const switchingPerformance = useRef(false);
  const mounted = useRef(false);

  const nativeAvailable = hasAndroidLocalAiRuntime();
  const deviceReady = Platform.OS === 'android' && device?.totalMemoryBytes != null;
  const recommendedModelId = useMemo(
    () => (deviceReady && device ? recommendLocalModel(device) : null),
    [device, deviceReady],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const [nextDevice, nextRuntime, modelChecks, freeStorageBytes, partialChecks] =
      await Promise.all([
          inspectAndroidDevice(),
          getAndroidRuntimeStatus(),
          Promise.all(
            LOCAL_MODELS.map(async (model) => {
              const uri = modelUri(model.id);
              if (!uri) return [model.id, false] as const;
              const info = await FileSystem.getInfoAsync(uri).catch(() => null);
              return [model.id, Boolean(info?.exists && (info.size ?? 0) >= model.bytes)] as const;
            }),
          ),
          Platform.OS === 'android'
            ? FileSystem.getFreeDiskStorageAsync().catch(() => undefined)
            : Promise.resolve(undefined),
          Promise.all(
            LOCAL_MODELS.map(
              async (model) => [model.id, await readPartialProgress(model.id)] as const,
            ),
          ),
        ]);
    if (!mounted.current) return;

    setDevice(
      nextDevice
        ? { ...nextDevice, freeStorageBytes: freeStorageBytes ?? nextDevice.freeStorageBytes }
        : null,
    );
    setRuntime(nextRuntime);
    if (nextRuntime?.backend) onBackendChange(nextRuntime.backend);
    setInstalled(Object.fromEntries(modelChecks) as Record<LocalModelId, boolean>);
    setPartial(Object.fromEntries(partialChecks) as Record<LocalModelId, number>);
  }, [onBackendChange]);

  useEffect(() => {
    if (!visible) return;
    void refresh();
    const interval = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(interval);
  }, [visible, refresh]);

  // Refresh when a download settles or completes elsewhere so installed/partial update.
  const wasActive = useRef(download != null);
  useEffect(() => {
    const settled = wasActive.current && download == null;
    wasActive.current = download != null;
    if (completedDownload != null || settled) void refresh();
  }, [completedDownload, download, refresh]);

  const activateModel = useCallback(
    async (modelId: LocalModelId) => {
      if (!nativeAvailable) {
        setError('Install an Android development build to run LiteRT-LM models.');
        return;
      }
      setStartingModelId(modelId);
      setMessage(null);
      setError(null);
      try {
        const nextRuntime = await startAndroidLocalModel(modelId);
        setInstalled((previous) => ({ ...previous, [modelId]: true }));
        setRuntime(nextRuntime);
        onBackendChange(nextRuntime.backend);
        onModelChoiceChange(modelId);
        setMessage(
          nextRuntime.backend
            ? `${LOCAL_MODEL_BY_ID[modelId].name} is ready on ${nextRuntime.backend}.`
            : `${LOCAL_MODEL_BY_ID[modelId].name} is ready.`,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'This model could not start on this phone.');
      } finally {
        setStartingModelId(null);
      }
    },
    [nativeAvailable, onBackendChange, onModelChoiceChange],
  );

  const switchPerformance = async (mode: PerformanceMode) => {
    if (switchingPerformance.current || mode === performance) return;
    switchingPerformance.current = true;
    const label = PERFORMANCE_OPTIONS.find((o) => o.value === mode)?.label ?? mode;
    setLocalAiPerformance(mode);
    setError(null);
    try {
      if (nativeAvailable) await setAndroidPerformanceMode(mode);
      if (runtime?.ready) {
        await warmAndroidLocalModel(modelChoice);
        const nextRuntime = await getAndroidRuntimeStatus();
        if (!mounted.current) return;
        setRuntime(nextRuntime);
        onBackendChange(nextRuntime?.backend ?? null);
        setMessage(
          nextRuntime?.backend
            ? `Now running on ${nextRuntime.backend} · ${label}`
            : `Performance set to ${label}.`,
        );
      } else {
        setMessage(`Performance set to ${label}.`);
      }
    } catch (e) {
      if (mounted.current) {
        setError(e instanceof Error ? e.message : 'Performance could not be changed.');
      }
    } finally {
      switchingPerformance.current = false;
    }
  };

  const confirmDownload = (modelId: LocalModelId) => {
    const profile = LOCAL_MODEL_BY_ID[modelId];
    const resumable = (partial[modelId] ?? 0) > 0;
    Alert.alert(
      resumable ? `Resume ${profile.name}?` : `Download ${profile.name}?`,
      resumable
        ? 'Picks up where it stopped.'
        : `About ${profile.sizeLabel}. Keep ${formatModelStorage(profile.bytes + STORAGE_HEADROOM)} free.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: resumable ? 'Resume' : 'Download',
          onPress: () => {
            setError(null);
            void startModelDownload(modelId);
          },
        },
      ],
    );
  };

  const chooseModel = (modelId: LocalModelId) => {
    if (installed[modelId]) {
      void activateModel(modelId);
    } else {
      confirmDownload(modelId);
    }
  };

  const handleUseAutomaticFit = async () => {
    if (!recommendedModelId) return;
    onModelChoiceChange('auto');
    setMessage('Ginto will pick the model that fits this phone.');
    setError(null);
    if (installed[recommendedModelId]) {
      await activateModel(recommendedModelId);
      onModelChoiceChange('auto');
    } else {
      onBackendChange(null);
    }
  };

  const deviceName = [device?.manufacturer, device?.modelName].filter(Boolean).join(' ');

  return (
    <Sheet open={visible} onClose={onClose}>
      <ScrollView
        style={{ maxHeight: profileListMaxHeight }}
        contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.sm }}
        showsVerticalScrollIndicator
      >
        <View style={styles.heading}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="heading">Chat models</Text>
          </View>
          <IconButton icon="close" label="Close chat settings" onPress={onClose} />
        </View>

        <Text variant="caption" color={colors.textMuted}>
          Auto picks a model and chip for your phone.
        </Text>

        <View style={styles.deviceCard}>
          <View style={styles.recommendationRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="strong">{deviceName || 'Android device'}</Text>
              <Text variant="caption" color={colors.textMuted}>
                {deviceReady ? `${formatRam(device?.totalMemoryBytes)} RAM` : 'Open on Android to check fit'}
              </Text>
            </View>
            <Button
              label={modelChoice === 'auto' ? 'Auto · On' : 'Use auto'}
              kind={modelChoice === 'auto' ? 'ghost' : 'ink'}
              size="sm"
              disabled={!deviceReady}
              onPress={() => void handleUseAutomaticFit()}
            />
          </View>
          {device?.chipset ? (
            <Text variant="caption" color={colors.textMuted}>
              Chip: {device.chipset}
            </Text>
          ) : null}
          {Platform.OS === 'android' && device?.npuName ? (
            <>
              <Text variant="caption">
                NPU: {device.npuName} · {device.npuReady ? 'ready' : 'found'}
              </Text>
              {!device.npuReady ? (
                <Text variant="caption" color={colors.textMuted}>
                  This build can&apos;t run models on it yet. Max still tries it, then falls back to GPU.
                </Text>
              ) : null}
            </>
          ) : Platform.OS === 'android' && deviceReady ? (
            <Text variant="caption" color={colors.textMuted}>
              NPU: not found · uses GPU or CPU
            </Text>
          ) : null}
          {Platform.OS === 'android' ? (
            <View style={{ gap: spacing.xs }}>
              <Text variant="strong">Performance</Text>
              <Segmented
                value={performance}
                onChange={(v) => void switchPerformance(v)}
                options={PERFORMANCE_OPTIONS}
              />
              <Text variant="caption" color={colors.textMuted}>
                {performance === 'max'
                  ? 'Uses the fastest chip it can, including the NPU. Faster replies, more battery and heat.'
                  : 'Saves battery and keeps your phone cool.'}
              </Text>
              {performance === 'max' &&
              device?.batteryPercent != null &&
              device.batteryPercent < 20 &&
              device.charging !== true ? (
                <Text variant="caption" color={colors.textMuted}>
                  Battery is low. Balanced will last longer.
                </Text>
              ) : null}
            </View>
          ) : null}
          {recommendedModelId ? (
            <View style={styles.recommendationRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="caption" color={colors.textMuted}>Recommended</Text>
                <Text variant="strong">{LOCAL_MODEL_BY_ID[recommendedModelId].name}</Text>
              </View>
              <View style={styles.recommendedBadge}>
                <Text variant="caption" style={styles.recommendedBadgeText}>
                  {runtime?.ready && runtime.backend ? runtime.backend : 'Auto'}
                </Text>
              </View>
            </View>
          ) : null}
          {runtime?.backendNote ? (
            <Text variant="caption" color={colors.textMuted}>
              {runtime.backendNote}
            </Text>
          ) : null}
          {deviceReady && !nativeAvailable ? (
            <Text variant="caption" color={colors.textMuted}>
              Android development build required.
            </Text>
          ) : null}
        </View>

        {PROFILE_GROUPS.map((group) => (
          <View key={group.title} style={styles.modelGroup}>
            <Text variant="strong">{group.title}</Text>
            {group.ids.map((modelId) => {
              const model = LOCAL_MODEL_BY_ID[modelId];
              const isRecommended = modelId === recommendedModelId;
              const isSelected = modelChoice === modelId;
              const isRunning = runtime?.ready && runtime.backend && runtime.modelPath?.endsWith(model.fileName);
              const thisDownload = download?.modelId === modelId ? download : null;
              const fitsDevice =
                device?.totalMemoryBytes == null || model.bytes <= device.totalMemoryBytes / 2;
              return (
                <View
                  key={model.id}
                  style={[styles.profileCard, isRecommended && styles.recommendedProfileCard]}
                >
                  <View style={styles.profileHeader}>
                    <Text variant="strong" style={{ flex: 1 }}>
                      {model.tier} · {model.name}
                    </Text>
                    {isRecommended ? (
                      <View style={styles.recommendedBadge}>
                        <Text variant="caption" style={styles.recommendedBadgeText}>
                          Best fit
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text variant="caption" color={colors.textMuted}>
                    {model.modality} · {model.sizeLabel} · {model.hardware}
                  </Text>
                  <Text variant="small">{model.use}</Text>
                  {model.modality === 'Text + Vision' ? (
                    <Text variant="caption" color={colors.textMuted}>
                      Reads photos privately on this phone.
                    </Text>
                  ) : null}
                  {!fitsDevice ? (
                    <Text variant="caption" color={colors.danger}>
                      This model needs more RAM than this phone has.
                    </Text>
                  ) : null}
                  {thisDownload ? (
                    <View style={styles.progressGroup}>
                      <ProgressBar value={thisDownload.value} height={10} />
                      <Text variant="caption">
                        Downloading · {Math.round(thisDownload.value * 100)}% · {model.sizeLabel}
                      </Text>
                      <Text variant="caption" color={colors.textMuted}>
                        You can leave this screen. The download keeps going.
                      </Text>
                      <Button
                        label="Cancel download"
                        kind="ghost"
                        size="sm"
                        onPress={() => {
                          setPartial((previous) => ({ ...previous, [modelId]: 0 }));
                          void cancelModelDownload();
                        }}
                      />
                    </View>
                  ) : (
                    <Button
                      label={
                        startingModelId === modelId
                          ? 'Checking hardware…'
                          : isRunning
                            ? `Running · ${runtime?.backend}`
                            : installed[modelId]
                              ? isSelected
                                ? 'Start this model'
                                : 'Use this model'
                              : (partial[modelId] ?? 0) > 0
                                ? `Resume download · ${Math.round((partial[modelId] ?? 0) * 100)}%`
                                : `Download · ${model.sizeLabel}`
                      }
                      kind={isSelected || isRecommended ? 'ink' : 'ghost'}
                      size="sm"
                      disabled={
                        startingModelId != null ||
                        download != null ||
                        isRunning === true ||
                        !nativeAvailable ||
                        !fitsDevice ||
                        Platform.OS !== 'android'
                      }
                      onPress={() => chooseModel(modelId)}
                    />
                  )}
                </View>
              );
            })}
          </View>
        ))}

        {message ? <Text variant="small" color={colors.success}>{message}</Text> : null}
        {(error ?? downloadError?.message) ? (
          <Text variant="small" color={colors.danger}>
            {error ?? downloadError?.message}
          </Text>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

const styles = {
  heading: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  deviceCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  recommendationRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  modelGroup: { gap: spacing.sm },
  profileCard: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  recommendedProfileCard: {
    borderColor: colors.primarySoft,
  },
  profileHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.sm,
  },
  recommendedBadge: {
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  recommendedBadgeText: { color: colors.text, fontFamily: fonts.semibold },
  progressGroup: { gap: spacing.sm },
};
