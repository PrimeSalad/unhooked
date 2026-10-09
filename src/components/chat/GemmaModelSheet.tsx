import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, useWindowDimensions, View } from 'react-native';

import {
  getAndroidRuntimeStatus,
  hasAndroidLocalAiRuntime,
  inspectAndroidDevice,
  startAndroidLocalModel,
} from '@/ai/androidLocalAi';
import {
  formatModelStorage,
  LOCAL_MODEL_BY_ID,
  LOCAL_MODELS,
  modelPartialUri,
  modelUri,
  recommendLocalModel,
  type AndroidDeviceProfile,
  type LocalModelChoice,
  type LocalModelId,
} from '@/ai/localModels';
import { Button, IconButton, ProgressBar, Sheet, Text } from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/constants/theme';

const STORAGE_HEADROOM = 400_000_000;
const PROFILE_GROUPS = [
  {
    title: 'Text-only',
    ids: ['gemma3-1b', 'qwen2.5-1.5b'] as LocalModelId[],
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

type DownloadProgress = { modelId: LocalModelId; value: number } | null;

type Props = {
  visible: boolean;
  onClose: () => void;
  modelChoice: LocalModelChoice;
  onModelChoiceChange: (choice: LocalModelChoice) => void;
  onBackendChange: (backend: string | null) => void;
};

const emptyInstalled = (): Record<LocalModelId, boolean> => ({
  'gemma3-1b': false,
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
  const [download, setDownload] = useState<DownloadProgress>(null);
  const [startingModelId, setStartingModelId] = useState<LocalModelId | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const task = useRef<FileSystem.DownloadResumable | null>(null);
  const mounted = useRef(false);
  const cancelRequested = useRef(false);
  const lastProgressUpdate = useRef(0);

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

  useEffect(() => {
    if (!visible) return;

    let alive = true;
    const refresh = async () => {
      const [nextDevice, nextRuntime, modelChecks, freeStorageBytes] = await Promise.all([
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
      ]);
      if (!alive || !mounted.current) return;

      setDevice(
        nextDevice
          ? { ...nextDevice, freeStorageBytes: freeStorageBytes ?? nextDevice.freeStorageBytes }
          : null,
      );
      setRuntime(nextRuntime);
      if (nextRuntime?.backend) onBackendChange(nextRuntime.backend);
      setInstalled(Object.fromEntries(modelChecks) as Record<LocalModelId, boolean>);
    };

    void refresh();
    const interval = setInterval(() => void refresh(), 30_000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [visible, onBackendChange]);

  const activateModel = async (modelId: LocalModelId) => {
    if (!nativeAvailable) {
      setError('Install an Android development build to run LiteRT-LM models.');
      return;
    }
    setStartingModelId(modelId);
    setMessage(null);
    setError(null);
    try {
      const nextRuntime = await startAndroidLocalModel(modelId);
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
  };

  const downloadModel = async (modelId: LocalModelId) => {
    if (!nativeAvailable || Platform.OS !== 'android') {
      setError('Downloads and local inference require an Android development build.');
      return;
    }

    const profile = LOCAL_MODEL_BY_ID[modelId];
    const uri = modelUri(modelId);
    const partialUri = modelPartialUri(modelId);
    const directory = uri ? uri.slice(0, uri.lastIndexOf('/') + 1) : null;
    if (!uri || !partialUri || !directory) {
      setError('Model storage is not available on this device.');
      return;
    }

    cancelRequested.current = false;
    lastProgressUpdate.current = 0;
    setError(null);
    setMessage(null);
    setDownload({ modelId, value: 0 });
    let activeTask: FileSystem.DownloadResumable | null = null;

    try {
      const freeBytes = device?.freeStorageBytes ?? (await FileSystem.getFreeDiskStorageAsync());
      if (freeBytes < profile.bytes + STORAGE_HEADROOM) {
        throw new Error(
          `Free up space first. Keep at least ${formatModelStorage(profile.bytes + STORAGE_HEADROOM)} available.`,
        );
      }

      const directoryInfo = await FileSystem.getInfoAsync(directory);
      if (!directoryInfo.exists) {
        await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      }
      await FileSystem.deleteAsync(partialUri, { idempotent: true });

      activeTask = FileSystem.createDownloadResumable(
        profile.url,
        partialUri,
        {},
        ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
          if (!mounted.current) return;
          const total = totalBytesExpectedToWrite > 0 ? totalBytesExpectedToWrite : profile.bytes;
          const value = Math.min(1, totalBytesWritten / total);
          const now = Date.now();
          if (now - lastProgressUpdate.current >= 300 || value >= 1) {
            lastProgressUpdate.current = now;
            setDownload({ modelId, value });
          }
        },
      );
      task.current = activeTask;

      const result = await activeTask.downloadAsync();
      if (!result || cancelRequested.current) return;
      if (result.status < 200 || result.status >= 300) {
        throw new Error(`The model host returned HTTP ${result.status}.`);
      }

      const downloaded = await FileSystem.getInfoAsync(partialUri);
      if (!downloaded.exists || (downloaded.size ?? 0) < profile.bytes) {
        throw new Error('The model download was incomplete. Check your connection and try again.');
      }

      await FileSystem.deleteAsync(uri, { idempotent: true });
      await FileSystem.moveAsync({ from: partialUri, to: uri });
      if (mounted.current) {
        setInstalled((previous) => ({ ...previous, [modelId]: true }));
        setDownload({ modelId, value: 1 });
      }
      await activateModel(modelId);
    } catch (e) {
      if (cancelRequested.current) return;
      await FileSystem.deleteAsync(partialUri, { idempotent: true }).catch(() => undefined);
      if (mounted.current) {
        setError(e instanceof Error ? e.message : 'The model could not be downloaded.');
        setDownload(null);
      }
    } finally {
      if (task.current === activeTask) task.current = null;
      if (mounted.current && !cancelRequested.current) {
        setDownload((current) => (current?.modelId === modelId ? null : current));
      }
    }
  };

  const confirmDownload = (modelId: LocalModelId) => {
    const profile = LOCAL_MODEL_BY_ID[modelId];
    Alert.alert(
      `Download ${profile.name}?`,
      `About ${profile.sizeLabel}. Keep ${formatModelStorage(profile.bytes + STORAGE_HEADROOM)} free.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download',
          onPress: () => void downloadModel(modelId),
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

  const cancelDownload = async () => {
    const activeTask = task.current;
    const modelId = download?.modelId;
    if (!activeTask || !modelId) return;
    cancelRequested.current = true;
    task.current = null;
    await activeTask.cancelAsync().catch(() => undefined);
    const partialUri = modelPartialUri(modelId);
    if (partialUri) await FileSystem.deleteAsync(partialUri, { idempotent: true }).catch(() => undefined);
    if (mounted.current) setDownload(null);
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
                      Image chat isn’t available yet.
                    </Text>
                  ) : null}
                  {thisDownload ? (
                    <View style={styles.progressGroup}>
                      <ProgressBar value={thisDownload.value} height={10} />
                      <Text variant="caption">
                        Downloading · {Math.round(thisDownload.value * 100)}% · {model.sizeLabel}
                      </Text>
                      <Button
                        label="Cancel download"
                        kind="ghost"
                        size="sm"
                        onPress={() => void cancelDownload()}
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
                              : `Download · ${model.sizeLabel}`
                      }
                      kind={isSelected || isRecommended ? 'ink' : 'ghost'}
                      size="sm"
                      disabled={
                        startingModelId != null ||
                        download != null ||
                        isRunning === true ||
                        !nativeAvailable ||
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
        {error ? <Text variant="small" color={colors.danger}>{error}</Text> : null}
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
