// Trial build: checks the 2-day window on launch, on every return to the app and once a
// minute while open. When it ends, the whole app is replaced by the "trial ended" screen and
// the native guards and reminders are switched off so nothing keeps running in the background.

import { useEffect, type ReactNode } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { configureCallScreening, stopAppGuard, stopWebGuard } from '../../modules/unhooked-guard';

import { Ginto } from '@/components/mascot/Ginto';
import { Button, Text } from '@/components/ui';
import { TRIAL_DAYS, TRIAL_SITE_URL } from '@/constants/trial';
import { colors, radius, spacing } from '@/constants/theme';
import { formatRemaining, type TrialStatus } from '@/domain/trial';
import { cancelAllReminders } from '@/lib/notifications';
import { checkTrial } from '@/lib/trial';

const RECHECK_MS = 60_000;

export const useTrial = create<{ status: TrialStatus | null }>(() => ({ status: null }));

async function refresh() {
  try {
    const status = await checkTrial();
    useTrial.setState({ status });
  } catch {
    // Storage unavailable: keep the last known state rather than locking out a valid install.
  }
}

function shutDownBackgroundWork() {
  if (Platform.OS === 'web') return;
  try {
    stopAppGuard();
    stopWebGuard();
    configureCallScreening([], 'off');
  } catch {
    // Native guard missing (Expo Go): nothing to stop.
  }
  void cancelAllReminders();
}

export function TrialGate({ children }: { children: ReactNode }) {
  const status = useTrial((s) => s.status);

  useEffect(() => {
    void refresh();
    const timer = setInterval(refresh, RECHECK_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);

  const expired = status?.expired ?? false;
  useEffect(() => {
    if (expired) shutDownBackgroundWork();
  }, [expired]);

  if (!status) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (expired) return <TrialEnded />;
  return <>{children}</>;
}

function TrialEnded() {
  return (
    <SafeAreaView style={styles.ended} edges={['top', 'bottom']}>
      <View style={styles.center}>
        <Ginto mood="calm" size={170} />
        <View style={styles.badge}>
          <Text variant="eyebrow" color={colors.primary} style={{ fontSize: 11 }}>
            Trial ended
          </Text>
        </View>
        <Text variant="title" color={colors.pauseText} align="center">
          Your {TRIAL_DAYS}-day trial is over
        </Text>
        <Text variant="body" color={colors.pauseMuted} align="center" style={{ maxWidth: 320 }}>
          Salamat for trying Unhooked. This was a trial build, so it no longer opens on this phone,
          and installing it again does not restart the trial.
        </Text>
        <Text variant="small" color={colors.pauseMuted} align="center" style={{ maxWidth: 320 }}>
          Your records stayed on this phone the whole time. Nothing was uploaded.
        </Text>
      </View>

      <View style={{ gap: spacing.md }}>
        <Button
          label="Visit the Unhooked site"
          icon="globe"
          onPress={() => Linking.openURL(TRIAL_SITE_URL)}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => Linking.openURL('tel:1553')}
          style={({ pressed }) => [styles.crisis, pressed && { opacity: 0.7 }]}
        >
          <Text variant="small" color={colors.pauseMuted} align="center">
            In crisis? Call NCMH{' '}
            <Text variant="strong" color={colors.pauseText}>
              1553
            </Text>{' '}
            or{' '}
            <Text variant="strong" color={colors.pauseText}>
              911
            </Text>
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/** Small "Trial · 1 day 4 h left" pill for the Today screen. */
export function TrialBadge() {
  const status = useTrial((s) => s.status);
  if (!status || status.expired) return null;
  return (
    <View style={styles.pill} accessibilityRole="text">
      <View style={styles.dot} />
      <Text variant="caption" color={colors.textSoft}>
        Trial · {formatRemaining(status.remainingMs)} left
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  ended: {
    flex: 1,
    backgroundColor: colors.pause,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,107,26,0.14)',
  },
  crisis: { paddingVertical: spacing.md },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.md,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
});
