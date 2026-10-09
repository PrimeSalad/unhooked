// The AI Pause: Trigger → Pause (real countdown) → Reflection → Recommendation → Decision.
// plan.md R1: decision buttons stay disabled until the countdown completes.
// The reflection is built from the user's own records; the AI only phrases computed facts.

import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';

import { getReflectionProvider, type Reflection } from '@/ai';
import { ActionError, FlowScreen } from '@/components/FlowLayout';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { bumpData } from '@/db/useDbQuery';
import { Ginto } from '@/components/mascot/Ginto';
import { CountdownRing } from '@/components/pause/CountdownRing';
import { Button, goBack, Rise, Tag, Text, TopBar } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { logEvent } from '@/db/events';
import {
  activeSession,
  endSession,
  getOverview,
  getPurchase,
  setPurchaseStatus,
  setSessionOutcome,
} from '@/db/repo';
import {
  borrowPauseFacts,
  checkoutPauseFacts,
  scrollPauseFacts,
  type PauseFactResult,
} from '@/domain/pauseFacts';
import { formatPHP } from '@/domain/money';
import type { BudgetProfile, PauseDecision } from '@/domain/types';
import { dueLabel } from '@/lib/format';
import { remindIn } from '@/lib/notifications';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

type Kind = 'checkout' | 'borrow' | 'scroll';

async function buildFacts(
  db: SQLiteDatabase,
  kind: Kind,
  params: { purchaseId?: string; amount?: string; app?: string; minutes?: string },
  budget: BudgetProfile | null,
  scrollLimit: number,
): Promise<PauseFactResult> {
  const o = await getOverview(db);
  const nextDueLabel = o.nextDue
    ? `${o.nextDue.debt.counterparty}: ${formatPHP(o.nextDue.outstanding)} · ${dueLabel(o.nextDue.debt.dueDate)}.`
    : '';
  const shared = { nextDueLabel, checkIn: o.checkIn };
  if (kind === 'borrow') {
    return borrowPauseFacts({
      ...shared,
      amount: Number(params.amount),
      owedTotal: o.owedTotal,
      dueThisMonth: o.dueThisMonth,
      spentThisMonth: o.spentThisMonth,
      budget,
    });
  }
  if (kind === 'scroll') {
    return scrollPauseFacts({
      ...shared,
      app: params.app ?? '',
      minutes: Number(params.minutes),
      limitMinutes: scrollLimit,
    });
  }
  const p = params.purchaseId ? await getPurchase(db, params.purchaseId) : null;
  return checkoutPauseFacts({
    ...shared,
    purchase: p,
    budget,
    dueThisMonth: o.dueThisMonth,
    spentThisMonth: o.spentThisMonth,
    owedTotal: o.owedTotal,
    modelContext: true,
  });
}

export default function PauseScreen() {
  const params = useLocalSearchParams<{
    kind?: string;
    purchaseId?: string;
    amount?: string;
    lender?: string;
    app?: string;
    minutes?: string;
    sessionId?: string;
  }>();
  const kind: Kind =
    params.kind === 'borrow' ? 'borrow' : params.kind === 'scroll' ? 'scroll' : 'checkout';

  const db = useSQLiteContext();
  const total = useSettings((s) => s.pauseSeconds);
  const budget = useSettings((s) => s.budget);
  const scrollLimit = useSettings((s) => s.scrollLimitMinutes);
  const showToast = useSession((s) => s.showToast);
  const snoozeScrollPause = useSession((s) => s.snoozeScrollPause);
  const setScrollReminderId = useSession((s) => s.setScrollReminderId);
  const action = useAsyncAction('Could not save your choice. Please try again.');
  const reduced = useReducedMotion();
  const [factsError, setFactsError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const [left, setLeft] = useState(total);
  const [title, setTitle] = useState(
    kind === 'borrow' ? 'Before you borrow' : kind === 'scroll' ? 'Time check' : 'Before you buy',
  );
  const [item, setItem] = useState('');
  const [reflection, setReflection] = useState<Reflection | null>(null);
  const [endsAt] = useState(() => Date.now() + total * 1000);
  const scrollDecisionPending = useRef(false);
  const locked = left > 0;

  useEffect(() => {
    void logEvent(db, 'pause_shown', { kind }).catch(() =>
      setFactsError('The activity record could not be saved.'),
    );
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [db, kind, endsAt]);

  useEffect(() => {
    let alive = true;
    buildFacts(
      db,
      kind,
      {
        purchaseId: params.purchaseId,
        amount: params.amount,
        app: params.app,
        minutes: params.minutes,
      },
      budget,
      scrollLimit,
    )
      .then(async ({ title: t, item: i, facts, checkIn }) => {
        const r = await getReflectionProvider().reflect({ kind, facts, latestCheckIn: checkIn });
        if (!alive) return;
        setTitle(t);
        setItem(i);
        setReflection(r);
      })
      .catch(() => {
        if (alive)
          setFactsError(
            'Your records could not be loaded. Retry or close this pause to return to your draft.',
          );
      });
    return () => {
      alive = false;
    };
  }, [
    budget,
    db,
    kind,
    params.amount,
    params.purchaseId,
    params.app,
    params.minutes,
    scrollLimit,
    attempt,
  ]);

  useEffect(() => {
    if (!locked && !reduced && Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [locked, reduced]);

  const done = async (decision: PauseDecision, outcome: string) => {
    await logEvent(db, 'pause_decision', {
      kind,
      decision,
      secondsViewed: total,
      modelVersion: reflection?.inference?.modelVersion,
      pressureScore: reflection?.inference?.score,
      pressureBand: reflection?.inference?.band,
    });
    bumpData();
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
    await done('save_for_later', 'saved');
  };
  const checkoutB = () => done('reconsider', 'cheaper');
  const checkoutC = async () => {
    if (params.purchaseId) await setPurchaseStatus(db, params.purchaseId, 'bought');
    await logEvent(db, 'pause_decision', {
      kind,
      decision: 'continue',
      secondsViewed: total,
      modelVersion: reflection?.inference?.modelVersion,
      pressureScore: reflection?.inference?.score,
      pressureBand: reflection?.inference?.band,
    });
    bumpData();
    goBack();
    showToast('Your call. Logged without judgment.');
  };
  const borrowC = async () => {
    void logEvent(db, 'pause_decision', {
      kind,
      decision: 'continue',
      secondsViewed: total,
      modelVersion: reflection?.inference?.modelVersion,
      pressureScore: reflection?.inference?.score,
      pressureBand: reflection?.inference?.band,
    });
    router.replace({
      pathname: '/debt-new',
      params: { direction: 'owed', amount: params.amount ?? '', counterparty: params.lender ?? '' },
    });
    showToast('Your call. Add it here so I can help you track it.');
  };

  const scrollDecision = async (
    decision: PauseDecision,
    outcome: 'intentional' | 'break' | 'snooze',
  ) => {
    if (scrollDecisionPending.current) return;
    scrollDecisionPending.current = true;
    try {
      const session = await activeSession(db);
      if (session && session.id === params.sessionId) {
        await setSessionOutcome(db, session.id, outcome);
        if (outcome === 'break') {
          await endSession(db, session.id);
        } else {
          const minutes = outcome === 'snooze' ? 10 : session.limitMinutes;
          snoozeScrollPause(session.id, Date.now() + minutes * 60000);
          const reminderId = await remindIn(
            minutes * 60,
            'Time check',
            'Still using this time the way you meant to?',
          );
          setScrollReminderId(session.id, reminderId);
        }
      }
      await logEvent(db, 'pause_decision', { kind, decision, secondsViewed: total });
      if (outcome === 'break') router.replace('/break');
      else {
        goBack();
        if (outcome === 'snooze') showToast('The next in-app check-in is in 10 minutes.');
      }
    } finally {
      scrollDecisionPending.current = false;
    }
  };

  const isBorrow = kind === 'borrow';
  const isScroll = kind === 'scroll';
  const options = isBorrow
    ? { a: 'Review what I owe', b: 'Ask for a payment plan instead', c: 'Borrow anyway' }
    : isScroll
      ? {
          a: 'I am using this on purpose',
          b: 'Take a break',
          c: 'Remind me in 10 minutes',
        }
      : { a: 'Save for 24 hours', b: 'Look for a cheaper option', c: 'Buy anyway' };

  const elapsed = total - left;
  const breath = Math.floor(elapsed / 4) % 2 === 0 ? 'Breathe in' : 'Breathe out';
  const mood = locked ? 'calm' : isBorrow ? 'worried' : isScroll ? 'sleepy' : 'curious';
  const disabled = locked || !reflection || action.pending;
  return (
    <FlowScreen bg={colors.pause}>
      <TopBar icon="close" dark />
      <View style={{ gap: spacing.sm }}>
        <Text variant="eyebrow" color={colors.pauseMuted}>
          {isBorrow ? 'Before you borrow' : isScroll ? 'Your time, your choice' : 'Before you buy'}
        </Text>
        <Text variant="title" color={colors.pauseText}>
          {title}
        </Text>
        {item ? <Text color={colors.pauseMuted}>{item}</Text> : null}
      </View>
      <View style={{ alignItems: 'center', paddingVertical: spacing.md, gap: spacing.lg }}>
        {locked ? (
          <CountdownRing seconds={total} size={210}>
            <Ginto mood={mood} size={148} />
          </CountdownRing>
        ) : (
          <Ginto mood={mood} size={120} />
        )}
        <Text variant="heading" color={colors.pauseText}>
          {locked ? breath : 'You have a little more space now.'}
        </Text>
        <Text variant="small" color={colors.pauseMuted} align="center">
          {locked
            ? left + (left === 1 ? ' second' : ' seconds') + ' · then choose what comes next'
            : 'There is no perfect answer. There is your next choice.'}
        </Text>
      </View>
      <ActionError
        message={factsError}
        onRetry={() => {
          setFactsError(null);
          setAttempt((value) => value + 1);
        }}
      />
      {!locked && reflection ? (
        <Rise
          style={{
            gap: spacing.lg,
            paddingTop: spacing.xl,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.18)',
          }}
        >
          <Tag certainty={reflection.headlineCertainty} dark />
          <Text variant="heading" color={colors.pauseText}>
            {reflection.headline}
          </Text>
          {[...reflection.lines, ...reflection.suggestions].map((line) => (
            <View key={line.text} style={{ gap: spacing.xs }}>
              <Text variant="small" color={colors.pauseMuted}>
                {line.certainty === 'fact'
                  ? 'From your records'
                  : line.certainty === 'estimate'
                    ? 'Estimate'
                    : 'One option'}
              </Text>
              <Text color={colors.pauseText}>{line.text}</Text>
            </View>
          ))}
        </Rise>
      ) : !locked && !factsError ? (
        <Text color={colors.pauseMuted}>Reading your records…</Text>
      ) : null}
      <ActionError message={action.error} />
      <View style={{ gap: spacing.md }}>
        <Button
          label={options.a}
          disabled={disabled}
          loading={action.pending}
          onPress={() =>
            void action.run(() =>
              isBorrow
                ? done('reconsider', 'review')
                : isScroll
                  ? scrollDecision('continue', 'intentional')
                  : checkoutA(),
            )
          }
        />
        <Button
          label={options.b}
          kind="outlineLight"
          disabled={disabled}
          onPress={() =>
            void action.run(() =>
              isBorrow
                ? done('reconsider', 'plan')
                : isScroll
                  ? scrollDecision('break', 'break')
                  : checkoutB(),
            )
          }
        />
        <Button
          label={options.c}
          kind="ghostLight"
          disabled={disabled}
          onPress={() =>
            void action.run(() =>
              isBorrow
                ? borrowC()
                : isScroll
                  ? scrollDecision('reconsider', 'snooze')
                  : checkoutC(),
            )
          }
        />
      </View>
    </FlowScreen>
  );
}
