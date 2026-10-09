import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable } from 'react-native';

import { startAndroidLocalModel } from '@/ai/androidLocalAi';
import {
  LOCAL_MODEL_BY_ID,
  LOCAL_MODELS,
  modelUri,
  type LocalModelChoice,
  type LocalModelId,
} from '@/ai/localModels';
import { Card, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { useSettings } from '@/store/settings';

const emptyInstalled = (): Record<LocalModelId, boolean> => ({
  'qwen3-0.6b': false,
  'qwen2.5-1.5b': false,
  'gemma4-e2b': false,
  'gemma4-e4b': false,
});

export function AgentModelCard() {
  const choice = useSettings((s) => s.localAiModel);
  const setChoice = useSettings((s) => s.setLocalAiModel);
  const [installed, setInstalled] = useState(emptyInstalled);
  const [busy, setBusy] = useState<LocalModelId | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const entries = await Promise.all(
      LOCAL_MODELS.map(async (model) => {
        const uri = modelUri(model.id);
        if (!uri) return [model.id, false] as const;
        const file = await FileSystem.getInfoAsync(uri).catch(() => null);
        const ready = Boolean(file?.exists && (file.size ?? 0) >= model.bytes);
        return [model.id, ready] as const;
      }),
    );
    setInstalled(Object.fromEntries(entries) as Record<LocalModelId, boolean>);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const select = async (next: LocalModelChoice) => {
    if (next !== 'auto' && !installed[next]) return;
    setError(null);
    setChoice(next);
    if (next === 'auto') {
      setNote(
        'Auto uses the downloaded model that fits this phone. Qwen 2.5 1.5B is the usual pick.',
      );
      return;
    }
    if (Platform.OS !== 'android') {
      setNote(`${LOCAL_MODEL_BY_ID[next].name} will be used on Android.`);
      return;
    }
    setBusy(next);
    try {
      const runtime = await startAndroidLocalModel(next);
      const where = runtime.backend ? ` on ${runtime.backend}` : '';
      setNote(`${LOCAL_MODEL_BY_ID[next].name} is ready${where}. Ask Ginto will use it.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This model could not start.');
    } finally {
      setBusy(null);
    }
  };

  const activeLabel = choice === 'auto' ? 'Auto' : LOCAL_MODEL_BY_ID[choice].name;

  return (
    <Card style={{ gap: spacing.sm }}>
      <Text variant="strong">On-device agent</Text>
      <Text variant="small" color={colors.textMuted}>
        Choose a downloaded model to test. In use now: {activeLabel}. Everything runs on this phone.
      </Text>
      <ModelOption
        label="Auto"
        detail="Picks from the models already on this phone"
        selected={choice === 'auto'}
        disabled={busy != null}
        onPress={() => void select('auto')}
      />
      {LOCAL_MODELS.map((model) => {
        const onPhone = installed[model.id];
        return (
          <ModelOption
            key={model.id}
            label={model.name}
            detail={
              busy === model.id
                ? 'Starting…'
                : onPhone
                  ? `${model.sizeLabel} · on this phone`
                  : 'Not downloaded yet'
            }
            selected={choice === model.id}
            disabled={!onPhone || busy != null}
            onPress={() => void select(model.id)}
          />
        );
      })}
      {note ? (
        <Text variant="caption" color={colors.success}>
          {note}
        </Text>
      ) : null}
      {error ? (
        <Text variant="caption" color={colors.danger}>
          {error}
        </Text>
      ) : null}
    </Card>
  );
}

function ModelOption({
  label,
  detail,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  detail: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        gap: 2,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: colors.surface,
        opacity: disabled && !selected ? 0.45 : 1,
      }}
    >
      <Text variant="strong">{selected ? `${label} · in use` : label}</Text>
      <Text variant="caption" color={colors.textMuted}>
        {detail}
      </Text>
    </Pressable>
  );
}
