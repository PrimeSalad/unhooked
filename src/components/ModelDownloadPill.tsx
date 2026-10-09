import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { startAndroidLocalModel } from '@/ai/androidLocalAi';
import { LOCAL_MODEL_BY_ID } from '@/ai/localModels';
import { clearCompletedDownload, useModelDownloads } from '@/ai/modelDownloads';
import { ProgressBar, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

const HIDDEN_ROUTES = new Set([
  '/chat',
  '/pause',
  '/shield',
  '/unhooked',
  '/break',
  '/fade-preview',
  '/welcome',
]);

/**
 * Global download pill, mounted once in the root layout so a model download survives
 * screen changes. Also owns completion: activates the freshly downloaded model and
 * reports it, no matter which screen is showing. Tap opens the Chat models sheet.
 */
export function ModelDownloadHost() {
  const active = useModelDownloads((s) => s.active);
  const completed = useModelDownloads((s) => s.completed);
  const error = useModelDownloads((s) => s.error);
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const v = useState(() => new Animated.Value(0))[0];
  const handledCompleted = useRef<string | null>(null);
  const handledError = useRef<typeof error>(null);
  const downloading = active != null;

  useEffect(() => {
    if (!downloading) return;
    v.setValue(0);
    Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 8 }).start();
  }, [downloading, v]);

  useEffect(() => {
    if (!completed) {
      handledCompleted.current = null;
      return;
    }
    if (handledCompleted.current === completed) return;
    handledCompleted.current = completed;
    const profile = LOCAL_MODEL_BY_ID[completed];
    void (async () => {
      try {
        const status = await startAndroidLocalModel(completed);
        useSettings.getState().setLocalAiModel(completed);
        useSession
          .getState()
          .showToast(`${profile.name} is ready${status.backend ? ` on ${status.backend}` : ''}.`);
      } catch {
        useSession
          .getState()
          .showToast(`${profile.name} downloaded. Open Chat models to start it.`);
      } finally {
        clearCompletedDownload();
      }
    })();
  }, [completed]);

  useEffect(() => {
    if (!error || error === handledError.current) return;
    handledError.current = error;
    if (pathname !== '/chat') {
      useSession.getState().showToast('Download paused. Open Chat models to resume.');
    }
  }, [error, pathname]);

  if (!active || HIDDEN_ROUTES.has(pathname)) return null;
  const profile = LOCAL_MODEL_BY_ID[active.modelId];
  const pct = Math.round(active.value * 100);

  return (
    <Animated.View
      style={[
        styles.pill,
        {
          top: insets.top + spacing.sm,
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open chat models"
        onPress={() => router.push({ pathname: '/chat', params: { models: '1' } })}
        style={styles.pressable}
      >
        <Text variant="caption" color={colors.bg}>
          Downloading {profile.name} · {pct}%
        </Text>
        <ProgressBar
          value={active.value}
          height={3}
          color={colors.bg}
          track="rgba(255,246,236,0.28)"
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    backgroundColor: colors.text,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  pressable: { gap: spacing.xs },
});
