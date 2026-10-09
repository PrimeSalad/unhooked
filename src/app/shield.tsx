// The shield: shown when a guarded app opens (Android guard service deep-links here) or as a preview.
// one sec pattern: real countdown, attempt count, then the user decides (R1, R4).

import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { goHome } from '../../modules/unhooked-guard';

import { DotPattern } from '@/components/DotPattern';
import { Ginto } from '@/components/mascot/Ginto';
import { Hook } from '@/components/mascot/Hook';
import { CountdownRing } from '@/components/pause/CountdownRing';
import { Button, Chips, goBack, Rise, Row, Sheet, Tag, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { attemptsToday } from '@/db/blockRules';
import { logEvent } from '@/db/events';
import { scrollStats } from '@/db/repo';
import { pauseSecondsFor } from '@/domain/blocking';
import { formatMinutes } from '@/domain/scroll';
import { isGuardAvailable, letThrough } from '@/lib/guard';
import { timeLeft } from '@/lib/format';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

const OPEN_FOR = ['5', '10', '15'] as const;

export default function ShieldScreen() {
  const p = useLocalSearchParams<{
    pkg?: string;
    label?: string;
    mode?: string;
    preview?: string;
  }>();
  const label = p.label || 'this app';
  const target = p.pkg || label;
  const strict = p.mode === 'strict';
  const preview = p.preview === '1' || !isGuardAvailable();

  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const showToast = useSession((s) => s.showToast);
  const base = useSettings((s) => s.pauseSeconds);
  const timerUntil = useSettings((s) => s.timerUntil);
  const seconds = pauseSecondsFor(strict ? 'strict' : 'pause', base);

  const [left, setLeft] = useState(seconds);
  const [attempts, setAttempts] = useState(0);
  const [scrolled, setScrolled] = useState(0);
  const [openFor, setOpenFor] = useState<(typeof OPEN_FOR)[number]>('10');
  const [confirm, setConfirm] = useState(false);
  const locked = left > 0;
  const timer = timerUntil ? timeLeft(timerUntil) : null;

  useEffect(() => {
    void (async () => {
      await logEvent(db, 'block_shield_shown', { target, preview });
      setAttempts((await attemptsToday(db))[target] ?? 1);
      setScrolled((await scrollStats(db)).todayMinutes);
    })();
    const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(t);
  }, [db, preview, target]);

  const decide = (decision: 'close' | 'break' | 'open') =>
    logEvent(db, 'block_decision', { target, decision, secondsViewed: seconds });

  const close = async () => {
    await decide('close');
    if (!preview) goHome();
    router.dismissTo('/scroll');
    if (preview) showToast(`On your phone, this sends you home instead of ${label}.`);
  };

  const open = async () => {
    setConfirm(false);
    await decide('open');
    if (preview) {
      goBack();
      showToast(`On your phone, ${label} would open for ${openFor} minutes.`);
      return;
    }
    letThrough(target, Number(openFor));
    router.dismissTo('/scroll');
  };

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <DotPattern color="#8CDCEB" opacity={0.1} gap={26} />
      <Hook x={250} y={locked ? 96 : 60} shown={locked} />

      <View style={{ gap: 4, maxWidth: '70%' }}>
        <Text variant="eyebrow" color={colors.pauseMuted}>
          {preview ? 'Preview · hook guard' : 'Hook guard'}
        </Text>
        <Text variant="title" color={colors.pauseText} style={{ fontSize: 28, lineHeight: 34 }}>
          {label}
        </Text>
        <Text variant="small" color={colors.pauseMuted}>
          {attempts > 1 ? `Opened ${attempts} times today` : 'First time today'}
        </Text>
      </View>

      <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
        {locked ? (
          <CountdownRing seconds={seconds} size={230}>
            <Ginto mood="calm" size={176} />
          </CountdownRing>
        ) : (
          <Ginto mood="curious" size={150} />
        )}
      </View>

      <View style={{ flex: 1, marginTop: spacing.lg }}>
        {locked ? (
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text variant="heading" color={colors.pauseText} style={{ fontSize: 22 }}>
              {Math.floor((seconds - left) / 4) % 2 === 0 ? 'Breathe in' : 'Breathe out'}
            </Text>
            <Text variant="small" color={colors.pauseMuted}>
              {left}s · {strict ? 'strict guard' : 'choices unlock after the pause'}
            </Text>
          </View>
        ) : (
          <Rise>
            <View style={styles.reflection}>
              <Text variant="heading" color={colors.pauseText}>
                {timer ? 'Your Unhook timer is still running.' : 'What did you open it for?'}
              </Text>
              <View style={{ gap: 4 }}>
                <Tag certainty="fact" dark />
                <Text variant="small" color="#FFE9D2">
                  {scrolled > 0
                    ? `${formatMinutes(scrolled)} of tracked scrolling today.`
                    : 'No tracked scrolling yet today.'}
                  {timer ? ` Timer: ${timer}.` : ''}
                </Text>
              </View>
              <View style={{ gap: 4 }}>
                <Tag certainty="suggestion" dark />
                <Text variant="small" color="#FFE9D2">
                  If it was a reflex, close it and do one small thing offline.
                </Text>
              </View>
            </View>
          </Rise>
        )}
      </View>

      <View style={{ gap: 10 }}>
        <Button label={`Close ${label}`} disabled={locked} onPress={() => void close()} />
        <Button
          label="Take a break with Ginto"
          kind="outlineLight"
          disabled={locked}
          onPress={async () => {
            await decide('break');
            router.replace('/break');
          }}
        />
        <Row style={{ justifyContent: 'space-between' }}>
          <Button
            label="Open anyway"
            kind="ghostLight"
            size="sm"
            disabled={locked}
            onPress={() => setConfirm(true)}
          />
          <Button
            label="Need to talk to someone?"
            kind="ghostLight"
            size="sm"
            onPress={() => router.push('/help')}
          />
        </Row>
      </View>

      <Sheet open={confirm} onClose={() => setConfirm(false)} mascot="worried">
        <Text variant="heading" align="center">
          {strict ? 'Still want to open it?' : `Open ${label} for`}
        </Text>
        <Chips
          value={openFor}
          onChange={setOpenFor}
          options={OPEN_FOR.map((m) => ({ value: m, label: `${m} min` }))}
        />
        <Text variant="caption" align="center">
          I will step in again after that.
        </Text>
        <Button label={`Open for ${openFor} minutes`} kind="ink" onPress={() => void open()} />
        <Button label="Never mind, close it" kind="ghost" size="sm" onPress={() => void close()} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.pause,
    paddingHorizontal: spacing.xl,
    overflow: 'hidden',
  },
  reflection: {
    backgroundColor: 'rgba(255,246,236,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,246,236,0.14)',
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
});
