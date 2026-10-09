import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DotPattern } from '@/components/DotPattern';
import { Ginto } from '@/components/mascot/Ginto';
import { Hook } from '@/components/mascot/Hook';
import { Button, Rise, Text, TopBar } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { emptyOverview, getOverview } from '@/db/repo';
import { useDbQuery } from '@/db/useDbQuery';
import { formatPHP } from '@/domain/money';

type Outcome = 'saved' | 'cheaper' | 'review' | 'plan';

const PLAN_MESSAGE =
  'Hello. I want to keep paying my loan, but I cannot pay the full amount on the due date. Can we agree on a payment arrangement with smaller amounts? Thank you.';

export default function UnhookedScreen() {
  const params = useLocalSearchParams<{ outcome?: string; item?: string; amount?: string }>();
  const outcome = (
    ['saved', 'cheaper', 'review', 'plan'].includes(params.outcome ?? '') ? params.outcome : 'saved'
  ) as Outcome;
  const item = params.item || 'it';
  const { data: o } = useDbQuery(getOverview, emptyOverview);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [hooked, setHooked] = useState(true);

  // The hook arrives where the pause left it, then gets yanked away.
  useEffect(() => {
    const t = setTimeout(() => setHooked(false), 350);
    return () => clearTimeout(t);
  }, []);

  const copy: Record<Outcome, string> = {
    saved: `${item[0]?.toUpperCase()}${item.slice(1)} is saved for 24 hours. You can review it in Spend tomorrow.`,
    cheaper: 'Take your time looking. A cheaper option keeps more of your month safe.',
    review: `Good call. ${params.amount ? `${formatPHP(Number(params.amount))} can wait. ` : ''}Let us look at what is due first.`,
    plan: 'Asking for a payment plan is a strong move. Here is a message you can send and edit.',
  };
  const toDebt = outcome === 'review' || outcome === 'plan';

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + spacing.xl }]}>
      <DotPattern />
      <View style={{ paddingTop: insets.top + spacing.md }}>
        <TopBar icon="close" onPress={() => router.dismissTo('/')} />
      </View>
      <Hook x={width / 2 + 70} y={insets.top + 90} shown={hooked} lineColor="#FFE1B8" />

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Ginto mood="proud" size={Math.min(outcome === 'plan' ? 180 : 240, width * 0.62)} />
      </View>

      <Rise style={{ gap: spacing.md }}>
        <Text variant="display" style={{ fontSize: 52, lineHeight: 56 }}>
          Unhooked.
        </Text>
        <Text>{copy[outcome]}</Text>
        {outcome === 'plan' && (
          <View style={styles.draft}>
            <Text variant="small" color={colors.text}>
              {PLAN_MESSAGE}
            </Text>
          </View>
        )}
        <View style={styles.chip}>
          <Text variant="strong" style={{ fontSize: 13 }}>
            {o.dodgedToday} {o.dodgedToday === 1 ? 'hook' : 'hooks'} dodged today
          </Text>
        </View>
        {outcome === 'plan' && (
          <Button
            label="Send this message"
            kind="ink"
            icon="share"
            onPress={() => void Share.share({ message: PLAN_MESSAGE })}
          />
        )}
        <Button
          label={toDebt ? 'See what I owe' : 'Back to Today'}
          kind={outcome === 'plan' ? 'outline' : 'ink'}
          style={{ marginTop: outcome === 'plan' ? 0 : spacing.sm }}
          onPress={() => router.dismissTo(toDebt ? '/debt' : '/')}
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
  draft: {
    backgroundColor: 'rgba(255,246,236,0.9)',
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
});
