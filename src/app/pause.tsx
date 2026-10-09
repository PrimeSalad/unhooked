// The AI Pause: Trigger → Pause (real countdown) → Reflection → Recommendation → Decision.
// plan.md R1: decision buttons stay disabled until the countdown completes.
// The reflection is built from the user's own records; the AI only phrases computed facts.

import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getReflectionProvider, type PauseContext, type Reflection } from '@/ai';
import { DotPattern } from '@/components/DotPattern';
import { Ginto } from '@/components/mascot/Ginto';
import { Hook } from '@/components/mascot/Hook';
import { CountdownRing } from '@/components/pause/CountdownRing';
import { Button, goBack, Rise, Row, Tag, Text } from '@/components/ui';
import { colors, motion, radius, spacing } from '@/constants/theme';
import { logEvent } from '@/db/events';
import { getOverview, getPurchase, setPurchaseStatus } from '@/db/repo';
import { checkAffordability } from '@/domain/affordability';
import { formatPHP } from '@/domain/money';
import type { BudgetProfile, PauseDecision, WellnessCheckIn } from '@/domain/types';
import { dueLabel } from '@/lib/format';
import { remindIn } from '@/lib/notifications';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

type Kind = 'checkout' | 'borrow';

const STAGE = 290;
const RING = 244;
const FISH = 200;

async function buildFacts(
  db: SQLiteDatabase,
  kind: Kind,
  params: { purchaseId?: string; amount?: string },
  budget: BudgetProfile | null,
): Promise<{
  title: string;
  item: string;
  facts: PauseContext['facts'];
  checkIn: WellnessCheckIn | null;
}> {
  const o = await getOverview(db);
  const nextDueLabel = o.nextDue
    ? `${o.nextDue.debt.counterparty}: ${formatPHP(o.nextDue.outstanding)} · ${dueLabel(o.nextDue.debt.dueDate)}.`
    : '';
  if (kind === 'borrow') {
    return {
      title: `Before you borrow ${formatPHP(Number(params.amount ?? 0))}`,
      item: '',
      facts: {
        amount: Number(params.amount ?? 0),
        owedTotal: o.owedTotal,
        dueThisMonth: o.dueThisMonth,
        nextDueLabel,
      },
      checkIn: o.checkIn,
    };
  }
  const p = params.purchaseId ? await getPurchase(db, params.purchaseId) : null;
  const price = p?.price ?? 0;
  const r = budget
    ? checkAffordability({
        price,
        budget,
        upcomingRepayments: o.dueThisMonth,
        spentThisMonth: o.spentThisMonth,
      })
    : null;
  return {
    title: p ? `Before you buy ${p.item}` : 'Before you buy',
    item: p?.item ?? '',
    facts: {
      price,
      hasBudget: budget ? 1 : 0,
      verdict: r?.verdict ?? '',
      remainingAfter: r?.remainingAfter ?? 0,
      shortfall: r?.shortfall ?? 0,
      nextDueLabel,
    },
    checkIn: o.checkIn,
  };
}

export default function PauseScreen() {
  const params = useLocalSearchParams<{
    kind?: string;
    purchaseId?: string;
    amount?: string;
    lender?: string;
  }>();
  const kind: Kind = params.kind === 'borrow' ? 'borrow' : 'checkout';

  const db = useSQLiteContext();
  const total = useSettings((s) => s.pauseSeconds);
  const budget = useSettings((s) => s.budget);
  const showToast = useSession((s) => s.showToast);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [left, setLeft] = useState(total);
  const [title, setTitle] = useState(kind === 'borrow' ? 'Before you borrow' : 'Before you buy');
  const [item, setItem] = useState('');
  const [reflection, setReflection] = useState<Reflection | null>(null);
  const [reveal] = useState(() => new Animated.Value(0));
  const locked = left > 0;

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
    let alive = true;
    buildFacts(db, kind, { purchaseId: params.purchaseId, amount: params.amount }, budget)
      .then(async ({ title: t, item: i, facts, checkIn }) => {
        const r = await getReflectionProvider().reflect({ kind, facts, latestCheckIn: checkIn });
        if (!alive) return;
        setTitle(t);
        setItem(i);
        setReflection(r);
      })
      .catch((e: unknown) => console.warn('pause facts failed', e));
    return () => {
      alive = false;
    };
  }, [budget, db, kind, params.amount, params.purchaseId]);

  useEffect(() => {
    if (locked) return;
    if (Platform.OS !== 'web')
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.timing(reveal, {
      toValue: 1,
      duration: motion.swim,
      easing: Easing.bezier(0.45, 0.05, 0.25, 1),
      useNativeDriver: true,
    }).start();
  }, [locked, reveal]);

  const done = (decision: PauseDecision, outcome: string) => {
    void logEvent(db, 'pause_decision', { kind, decision, secondsViewed: total });
    router.replace({
      pathname: '/unhooked',
      params: { outcome, item, amount: params.amount ?? '' },
    });
  };

  const checkoutA = async () => {
    if (params.purchaseId) await setPurchaseStatus(db, params.purchaseId, 'cooling');
    void remindIn(
      24 * 3600,
      'Ready to decide?',
      'Something you saved yesterday is waiting for a decision.',
    );
    done('save_for_later', 'saved');
  };
  const checkoutB = () => done('reconsider', 'cheaper');
  const checkoutC = async () => {
    if (params.purchaseId) await setPurchaseStatus(db, params.purchaseId, 'bought');
    void logEvent(db, 'pause_decision', { kind, decision: 'continue', secondsViewed: total });
    goBack();
    showToast('Your call. Logged without judgment.');
  };
  const borrowC = () => {
    void logEvent(db, 'pause_decision', { kind, decision: 'continue', secondsViewed: total });
    router.replace({
      pathname: '/debt-new',
      params: { direction: 'owed', amount: params.amount ?? '', counterparty: params.lender ?? '' },
    });
    showToast('Your call. Add it here so I can help you track it.');
  };

  const isBorrow = kind === 'borrow';
  const options = isBorrow
    ? { a: 'Review what I owe', b: 'Ask for a payment plan instead', c: 'Borrow anyway' }
    : { a: 'Save for 24 hours', b: 'Look for a cheaper option', c: 'Buy anyway' };

  const elapsed = total - left;
  const breath = Math.floor(elapsed / 4) % 2 === 0 ? 'Breathe in' : 'Breathe out';
  const mood = locked ? 'calm' : isBorrow ? 'worried' : 'curious';
  const stageW = width - spacing.xl * 2;

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
          {isBorrow ? 'Borrowing pause' : 'Checkout pause'}
        </Text>
        <Text
          variant="title"
          color={colors.pauseText}
          style={{ fontSize: 26, lineHeight: 32 }}
          numberOfLines={2}
        >
          {title}
        </Text>
      </View>

      <View style={{ height: STAGE, marginTop: spacing.lg }}>
        <Hook x={stageW / 2 + 92} y={locked ? 6 : -18} shown />
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

      <ScrollView
        style={{ flex: 1, marginTop: locked ? -40 : -76, marginBottom: spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        {locked || !reflection ? (
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
                {reflection.headline}
              </Text>
              {[...reflection.lines, ...reflection.suggestions].map((l) => (
                <View key={l.text} style={{ gap: 4 }}>
                  <Tag certainty={l.certainty} dark />
                  <Text variant="small" color="#FFE9D2">
                    {l.text}
                  </Text>
                </View>
              ))}
            </View>
          </Rise>
        )}
      </ScrollView>

      <View style={{ gap: 10 }}>
        <Button
          label={options.a}
          disabled={locked}
          onPress={() => (isBorrow ? done('reconsider', 'review') : void checkoutA())}
        />
        <Button
          label={options.b}
          kind="outlineLight"
          disabled={locked}
          onPress={() => (isBorrow ? done('reconsider', 'plan') : checkoutB())}
        />
        <Row style={{ justifyContent: 'space-between' }}>
          <Button
            label={options.c}
            kind="ghostLight"
            size="sm"
            disabled={locked}
            onPress={() => (isBorrow ? borrowC() : void checkoutC())}
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
