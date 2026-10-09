import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { buildSpendInsights, visibleInsights } from '@/ai/insights';
import { BudgetSetup } from '@/components/BudgetSetup';
import { InsightCard } from '@/components/InsightCard';
import {
  Avatar,
  Chips,
  Button,
  Group,
  GroupRow,
  LargeTitle,
  ProgressBar,
  Rise,
  Screen,
  Section,
  Sheet,
  Tag,
  Text,
} from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { emptyOverview, getOverview, listPurchases, setPurchaseStatus } from '@/db/repo';
import { listRules } from '@/db/blockRules';
import { recentEvents } from '@/db/events';
import { dismissInsight } from '@/db/insights';
import { useDbQuery } from '@/db/useDbQuery';
import { summarizeActivity } from '@/domain/activity';
import { checkAffordability } from '@/domain/affordability';
import { dailyAllowance, daysUntil, nextPayday } from '@/domain/allowance';
import { formatPHP } from '@/domain/money';
import { isShoppingApp, SHOPPING_APPS } from '@/domain/paydayShield';
import type { BudgetProfile, PlannedPurchase } from '@/domain/types';
import { shortDate, timeLeft } from '@/lib/format';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

const STATUS: Record<PlannedPurchase['status'], string> = {
  planned: 'Checked',
  cooling: 'Cooling off',
  bought: 'Bought',
  skipped: 'Skipped · money kept',
};

function DecideSheet({
  p,
  onClose,
  budget,
  dueThisMonth,
  spentThisMonth,
  now,
}: {
  p: PlannedPurchase | null;
  onClose: () => void;
  budget: BudgetProfile | null;
  dueThisMonth: number;
  spentThisMonth: number;
  now: number;
}) {
  const db = useSQLiteContext();
  const showToast = useSession((s) => s.showToast);
  const [busy, setBusy] = useState(false);
  if (!p) return null;
  const cooling = !!p.coolingUntil && new Date(p.coolingUntil).getTime() > now;
  const left = cooling && p.coolingUntil ? timeLeft(p.coolingUntil) : null;
  const estimate =
    !cooling && budget
      ? checkAffordability({
          price: p.price,
          budget,
          upcomingRepayments: dueThisMonth,
          spentThisMonth,
        })
      : null;
  const decide = async (status: 'bought' | 'skipped') => {
    if (busy) return;
    setBusy(true);
    try {
      await setPurchaseStatus(db, p.id, status);
      onClose();
      showToast(
        status === 'skipped' ? `You kept ${formatPHP(p.price)}.` : 'Logged without judgment.',
      );
    } catch {
      showToast('Could not save that choice. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} mascot={left ? 'calm' : 'curious'}>
      <Text variant="heading" align="center">
        {left ? `${p.item} is cooling off` : `Still want ${p.item}?`}
      </Text>
      <Text variant="small" align="center" color={colors.textMuted}>
        {formatPHP(p.price)} · {left ?? 'Ready to decide'}
      </Text>
      {p.plannedDate ? (
        <Text variant="caption" align="center" color={colors.textMuted}>
          Planned for {shortDate(p.plannedDate)}
        </Text>
      ) : null}
      {p.alternativePrice && p.alternativePrice < p.price ? (
        <Text variant="small" color={colors.success}>
          Your cheaper option was {formatPHP(p.alternativePrice)} —{' '}
          {formatPHP(p.price - p.alternativePrice)} less.
        </Text>
      ) : null}
      {estimate ? (
        <View style={{ gap: spacing.xs }}>
          <Tag tone="estimate" />
          <Text variant="strong">
            {estimate.verdict === 'comfortable'
              ? 'Looks affordable this month'
              : estimate.verdict === 'tight'
                ? 'This month looks tight'
                : dueThisMonth > 0
                  ? 'May conflict with repayments'
                  : 'Over your monthly budget'}
          </Text>
          <Text variant="small">
            Checking your current records again: about {formatPHP(estimate.remainingAfter)} remains
            after buying this
            {dueThisMonth > 0
              ? `, before ${formatPHP(dueThisMonth)} in repayments due this month.`
              : '.'}
          </Text>
          {budget?.payday === '15_30' ? (
            <Text variant="caption" color={colors.textMuted}>
              Monthly estimate only; it may not match cash available before your next payday.
            </Text>
          ) : null}
          {estimate.verdict === 'conflicts' ? (
            <Text variant="small" color={colors.spend}>
              This may leave about {formatPHP(estimate.shortfall)} uncovered.
            </Text>
          ) : null}
        </View>
      ) : !cooling ? (
        <Text variant="small" color={colors.textMuted}>
          Add your monthly budget in Settings to see an updated estimate.
        </Text>
      ) : null}
      <Button
        label="Skip it and keep the money"
        disabled={busy}
        onPress={() => void decide('skipped')}
      />
      {!cooling ? (
        <Button
          label="I bought it"
          kind="outline"
          disabled={busy}
          onPress={() => void decide('bought')}
        />
      ) : null}
    </Sheet>
  );
}

export default function SpendScreen() {
  const db = useSQLiteContext();
  const showToast = useSession((s) => s.showToast);
  const budget = useSettings((s) => s.budget);
  const { data: o } = useDbQuery(getOverview, emptyOverview);
  const { data: purchases } = useDbQuery(listPurchases, []);
  const { data: rules } = useDbQuery(listRules, []);
  const { data: events } = useDbQuery(recentEvents, []);
  const shoppingRules = rules.filter((r) => r.kind === 'app' && isShoppingApp(r.target, r.label));
  const previewShield = (pkg: string, label: string) =>
    router.push({ pathname: '/shield', params: { pkg, label, preview: '1' } });
  const [deciding, setDeciding] = useState<PlannedPurchase | null>(null);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const cooling = purchases.filter((p) => p.status === 'cooling');
  const recent = purchases.filter((p) => p.status !== 'cooling').slice(0, 6);
  const skipped = purchases.filter((p) => p.status === 'skipped');
  const kept = skipped.reduce((sum, p) => sum + p.price, 0);

  const available = budget
    ? budget.monthlyIncome - budget.monthlyFixedBills - budget.savingsGoalMonthly
    : 0;
  const committed = o.spentThisMonth + o.dueThisMonth;
  const free = available - committed;
  const payday = budget ? nextPayday(budget.payday, new Date(now)) : null;
  const days = payday ? daysUntil(payday, new Date(now)) : 0;
  const perDay = dailyAllowance(free, days);
  const activity = summarizeActivity(events, new Date(now));
  const spendInsights = visibleInsights(buildSpendInsights(o, budget), activity.dismissedIds);
  const hideInsight = async (id: string) => {
    try {
      await dismissInsight(db, id);
      showToast('Hidden for 7 days.');
    } catch {
      showToast('Could not hide this insight. Try again.');
    }
  };

  return (
    <Screen>
      <LargeTitle eyebrow="Check it before you check out" title="Spend" />

      {budget ? (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text variant="caption">Estimated free to spend per day</Text>
            <Tag tone="estimate" />
          </View>
          <Text variant="display" style={{ fontSize: 44, lineHeight: 50, letterSpacing: -1.5 }}>
            {formatPHP(perDay)}
          </Text>
          <Text variant="small" color={colors.textMuted}>
            {free > 0
              ? `${formatPHP(free)} left for ${days} ${days === 1 ? 'day' : 'days'} · payday ${shortDate(payday!.toISOString())}`
              : 'Your free-to-spend estimate is at or below zero after bills, savings and repayments.'}
          </Text>
          <ProgressBar
            value={available > 0 ? committed / available : 1}
            color={free > 0 ? colors.text : colors.spend}
            height={10}
          />
          <View style={styles.stats}>
            <Stat label="Bought" value={formatPHP(o.spentThisMonth)} />
            <Stat label="Repayments due" value={formatPHP(o.dueThisMonth)} />
            <Stat label="Kept by waiting" value={formatPHP(kept)} />
          </View>
        </View>
      ) : (
        <BudgetSetup />
      )}

      <Button
        label="Check a purchase"
        kind="ink"
        icon="search"
        onPress={() => router.push('/spend-check')}
      />

      <Section title="Payday shield">
        <Text variant="small" color={colors.textMuted} style={{ paddingHorizontal: 4 }}>
          When a guarded shopping app opens, you see your safe-to-spend, the next due date and what
          is cooling off.
        </Text>
        <Group>
          {shoppingRules.map((r) => (
            <GroupRow
              key={r.id}
              leading={<Avatar label={r.label} />}
              title={r.label}
              subtitle={r.enabled ? 'Guarded · tap to preview' : 'Paused · tap to preview'}
              onPress={() => previewShield(r.target, r.label)}
            />
          ))}
          <GroupRow
            icon="add"
            title={shoppingRules.length ? 'Guard more shopping apps' : 'Guard your shopping apps'}
            onPress={() => router.push('/block/apps?filter=shopping')}
          />
        </Group>
        {shoppingRules.length === 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="caption" style={{ paddingHorizontal: 4 }}>
              Preview the shield
            </Text>
            <Chips
              value={null}
              onChange={(pkg) => {
                const app = SHOPPING_APPS.find((a) => a.pkg === pkg)!;
                previewShield(app.pkg, app.label);
              }}
              options={SHOPPING_APPS.map((a) => ({ value: a.pkg as string, label: a.label }))}
            />
          </View>
        ) : null}
      </Section>

      <Section title="AI insights">
        {spendInsights.length ? (
          spendInsights.map((insight, index) => (
            <Rise key={insight.id} delay={60 * (index + 1)}>
              <InsightCard insight={insight} onDismiss={(id) => void hideInsight(id)} />
            </Rise>
          ))
        ) : (
          <Text variant="small" color={colors.textMuted}>
            Hidden insights return after 7 days.
          </Text>
        )}
      </Section>

      {cooling.length > 0 && (
        <Section title={`Cooling off · ${cooling.length}`}>
          <Group>
            {cooling.map((p) => {
              const left =
                p.coolingUntil && new Date(p.coolingUntil).getTime() > now
                  ? timeLeft(p.coolingUntil)
                  : null;
              return (
                <GroupRow
                  key={p.id}
                  icon="hourglass"
                  title={p.item}
                  subtitle={left ?? 'Ready to decide'}
                  value={formatPHP(p.price)}
                  onPress={() => setDeciding(p)}
                />
              );
            })}
          </Group>
        </Section>
      )}

      <Section title="History">
        {recent.length ? (
          <Group>
            {recent.map((p) => (
              <GroupRow
                key={p.id}
                leading={<Avatar label={p.item} />}
                title={p.item}
                subtitle={`${STATUS[p.status]}${p.plannedDate ? ` · ${shortDate(p.plannedDate)}` : ''}`}
                value={formatPHP(p.price)}
                valueTone={p.status === 'skipped' ? colors.success : undefined}
              />
            ))}
          </Group>
        ) : (
          <Text variant="small" color={colors.textMuted} style={{ paddingHorizontal: 4 }}>
            Purchases you check show up here, with what you kept by waiting.
          </Text>
        )}
      </Section>

      <DecideSheet
        key={deciding?.id ?? 'none'}
        p={deciding}
        onClose={() => setDeciding(null)}
        budget={budget}
        dueThisMonth={o.dueThisMonth}
        spentThisMonth={o.spentThisMonth}
        now={now}
      />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="strong">{value}</Text>
      <Text variant="caption">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stats: {
    flexDirection: 'row',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
});
