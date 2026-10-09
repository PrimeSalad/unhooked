// The AI Pause: Trigger → Pause (real countdown) → Reflection → Recommendation → Decision.
// plan.md R1: decision buttons stay disabled until the countdown completes.

import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DotPattern } from '@/components/DotPattern';
import { Ginto } from '@/components/mascot/Ginto';
import { Hook } from '@/components/mascot/Hook';
import { CountdownRing } from '@/components/pause/CountdownRing';
import { Button, Rise, Row, Tag, Text } from '@/components/ui';
import { colors, motion, radius, spacing } from '@/constants/theme';
import { logEvent } from '@/db/events';
import { pauseCopy } from '@/demo/ana';
import type { PauseDecision } from '@/domain/types';
import { type Outcome, useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

type Kind = keyof typeof pauseCopy;

const STAGE = 290;
const RING = 244;
const FISH = 200;

export default function PauseScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind: Kind = params.kind === 'borrow' ? 'borrow' : 'checkout';
  const copy = pauseCopy[kind];

  const db = useSQLiteContext();
  const total = useSettings((s) => s.pauseSeconds);
  const recordPause = useSession((s) => s.recordPause);
  const showToast = useSession((s) => s.showToast);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [left, setLeft] = useState(total);
  const locked = left > 0;
  const reveal = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    void logEvent(db, 'pause_shown', { kind });
    const timer = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) clearInterval(timer);
        return Math.max(0, l - 1);
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [db, kind]);

  useEffect(() => {
    if (locked) return;
    Animated.timing(reveal, {
      toValue: 1,
      duration: motion.swim,
      easing: Easing.bezier(0.45, 0.05, 0.25, 1),
      useNativeDriver: true,
    }).start();
  }, [locked, reveal]);

  const decide = (decision: PauseDecision, outcome?: Outcome) => {
    void logEvent(db, 'pause_decision', { kind, decision, secondsViewed: total });
    if (outcome) {
      recordPause(outcome);
      router.replace('/unhooked');
    } else {
      router.back();
      showToast('Your call. Logged without judgment.');
    }
  };

  const elapsed = total - left;
  const breath = Math.floor(elapsed / 4) % 2 === 0 ? 'Breathe in' : 'Breathe out';
  const mood = locked ? 'calm' : kind === 'borrow' ? 'worried' : 'curious';
  const stageW = width - spacing.xl * 2;
  const hookX = stageW / 2 + 92;

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <DotPattern color="#8CDCEB" opacity={0.1} gap={26} />

      <View style={{ gap: 4, maxWidth: '68%' }}>
        <Text variant="eyebrow" color={colors.pauseMuted}>
          {copy.eyebrow}
        </Text>
        <Text variant="title" color={colors.pauseText} style={{ fontSize: 26, lineHeight: 32 }}>
          {copy.title}
        </Text>
      </View>

      <View style={{ height: STAGE, marginTop: spacing.lg }}>
        <Hook x={hookX} y={locked ? 6 : -18} shown />
        <Animated.View
          style={[
            styles.center,
            { opacity: reveal.interpolate({ inputRange: [0, 0.5], outputRange: [1, 0] }) },
          ]}
        >
          <CountdownRing seconds={total} size={RING} />
        </Animated.View>
        <Animated.View
          style={[
            styles.center,
            {
              transform: [
                { translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [0, -36] }) },
                { scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [1, 0.8] }) },
              ],
            },
          ]}
        >
          <Ginto mood={mood} size={FISH} />
        </Animated.View>
      </View>

      <View style={{ flex: 1, marginTop: locked ? -40 : -76 }}>
        {locked ? (
          <View style={{ alignItems: 'center', gap: 4, marginTop: spacing.xxl }}>
            <Text variant="heading" color={colors.pauseText} style={{ fontSize: 22 }}>
              {breath}
            </Text>
            <Text variant="small" color={colors.pauseMuted}>
              {left} {left === 1 ? 'second' : 'seconds'} · choices unlock after the pause
            </Text>
          </View>
        ) : (
          <Rise>
            <View style={styles.reflection}>
              <Text variant="heading" color={colors.pauseText}>
                {copy.head}
              </Text>
              <View style={{ gap: 4 }}>
                <Tag certainty="fact" dark />
                <Text variant="small" color="#FFE9D2">
                  {copy.fact}
                </Text>
              </View>
              <View style={{ gap: 4 }}>
                <Tag certainty="estimate" dark />
                <Text variant="small" color="#FFE9D2">
                  {copy.estimate}
                </Text>
              </View>
            </View>
          </Rise>
        )}
      </View>

      <View style={{ gap: 10 }}>
        <Button
          label={copy.a}
          disabled={locked}
          onPress={() => decide('save_for_later', kind === 'borrow' ? 'review' : 'saved')}
        />
        <Button
          label={copy.b}
          kind="outlineLight"
          disabled={locked}
          onPress={() => decide('reconsider', kind === 'borrow' ? 'plan' : 'cheaper')}
        />
        <Row style={{ justifyContent: 'space-between' }}>
          <Button
            label={copy.c}
            kind="ghostLight"
            size="sm"
            disabled={locked}
            onPress={() => decide('continue')}
          />
          <Button
            label="Need to talk to someone?"
            kind="ghostLight"
            size="sm"
            onPress={() => router.push('/help')}
          />
        </Row>
      </View>
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
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
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
