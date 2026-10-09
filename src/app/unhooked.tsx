import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DotPattern } from '@/components/DotPattern';
import { Ginto } from '@/components/mascot/Ginto';
import { Hook } from '@/components/mascot/Hook';
import { Button, Rise, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { useSession, type Outcome } from '@/store/session';

const copy: Record<Outcome, { line: string; button: string; to: '/' | '/debt' }> = {
  saved: {
    line: 'Saved for 24 hours. I will nudge you tomorrow at 11:40 PM and we will check again together.',
    button: 'Back to Today',
    to: '/',
  },
  cheaper: {
    line: 'Earbuds under ₱2,000 would keep your Oct 15 repayment covered. Take your time.',
    button: 'Back to Today',
    to: '/',
  },
  review: {
    line: 'Good call. Let us look at what is due first, then decide.',
    button: 'See what I owe',
    to: '/debt',
  },
  plan: {
    line: 'I drafted a message asking Pera Agad for a payment arrangement. You can edit it before sending.',
    button: 'See what I owe',
    to: '/debt',
  },
};

export default function UnhookedScreen() {
  const outcome = useSession((s) => s.lastOutcome);
  const pauses = useSession((s) => s.pauses);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [hooked, setHooked] = useState(true);
  const c = copy[outcome];

  // The hook arrives where the pause left it, then gets yanked away.
  useEffect(() => {
    const t = setTimeout(() => setHooked(false), 350);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + spacing.xl }]}>
      <DotPattern />
      <Hook x={width / 2 + 70} y={insets.top + 90} shown={hooked} lineColor="#FFE1B8" />

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Ginto mood="proud" size={Math.min(240, width * 0.62)} />
      </View>

      <Rise style={{ gap: spacing.md }}>
        <Text variant="display" style={{ fontSize: 52, lineHeight: 56 }}>
          Unhooked.
        </Text>
        <Text>{c.line}</Text>
        <View style={styles.chip}>
          <Text variant="strong" style={{ fontSize: 13 }}>
            That is {pauses} hooks dodged today
          </Text>
        </View>
        <Button
          label={c.button}
          kind="ink"
          style={{ marginTop: spacing.sm }}
          onPress={() => router.dismissTo(c.to)}
        />
      </Rise>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    overflow: 'hidden',
  },
  chip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(42,22,8,0.12)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
});
