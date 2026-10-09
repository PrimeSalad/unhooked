import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';

export type ThinkingPhase = 'loading' | 'thinking';

/**
 * Bouncing-dots placeholder shown while Ginto works. Dots animate in a staggered loop
 * unless Reduce Motion is on; the status line names the phase and, after 8 s, shows
 * elapsed seconds so a cold model start doesn't look frozen.
 */
export function ThinkingBubble({
  phase,
  modelName,
  image,
  style,
}: {
  phase: ThinkingPhase;
  modelName?: string | null;
  image?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [dots] = useState(() => [0, 1, 2].map(() => new Animated.Value(0)));
  const [elapsed, setElapsed] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduceMotion(enabled);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const loops = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 320,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          // Equal total loop length for every dot keeps the stagger in phase.
          Animated.delay((dots.length - 1 - i) * 150 + 360),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [dots, reduceMotion]);

  const status =
    phase === 'loading'
      ? `Starting ${modelName ?? 'the model'}…`
      : image
        ? 'Reading your photo…'
        : 'Thinking…';

  return (
    <View
      style={[style, styles.container]}
      accessibilityLiveRegion="polite"
      accessibilityLabel="Ginto is thinking"
    >
      <View style={styles.dots}>
        {reduceMotion
          ? [0, 1, 2].map((i) => <View key={i} style={styles.dot} />)
          : dots.map((dot, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  {
                    opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
                    transform: [
                      {
                        translateY: dot.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -5],
                        }),
                      },
                    ],
                  },
                ]}
              />
            ))}
      </View>
      <Text variant="caption" color={colors.textMuted}>
        {elapsed >= 8 ? `${status} · ${elapsed}s` : status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 16,
  },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textMuted },
});
