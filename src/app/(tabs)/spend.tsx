import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BudgetSetup } from '@/components/BudgetSetup';
import {
  Avatar,
  Button,
  Group,
  GroupRow,
  IconButton,
  LargeTitle,
  Screen,
  Section,
  Sheet,
  Tag,
  Text,
} from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { emptyOverview, getOverview, listPurchases, setPurchaseStatus } from '@/db/repo';
import { useDbQuery } from '@/db/useDbQuery';
import { checkAffordability } from '@/domain/affordability';
import { formatPHP } from '@/domain/money';
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
  const budget = useSettings((s) => s.budget);
  const { data: o } = useDbQuery(getOverview, emptyOverview);
  const { data: purchases } = useDbQuery(listPurchases, []);
  const [deciding, setDeciding] = useState<PlannedPurchase | null>(null);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const cooling = purchases.filter((p) => p.status === 'cooling');
  const recent = purchases.filter((p) => p.status !== 'cooling').slice(0, 5);
  const kept = purchases.filter((p) => p.status === 'skipped').reduce((s, p) => s + p.price, 0);
  const free = budget
    ? budget.monthlyIncome -
      budget.monthlyFixedBills -
      budget.savingsGoalMonthly -
      o.spentThisMonth -
      o.dueThisMonth
    : 0;

  return (
    <Screen>
      <LargeTitle
        eyebrow="Check it before you check out"
        title="Spend"
        right={
          <IconButton
            icon="add"
            label="Check a purchase"
            tone={colors.text}
            color={colors.bg}
            onPress={() => router.push('/spend-check')}
          />
        }
      />

      {budget ? (
        <View style={styles.hero}>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Text variant="eyebrow" color={colors.textMuted} style={{ fontSize: 11 }}>
              After repayments this month
            </Text>
            <Tag tone="estimate" />
          </View>
          <Text variant="display" style={{ fontSize: 42, lineHeight: 48 }}>
            {formatPHP(free)}
          </Text>
          {budget.payday === '15_30' ? (
            <Text variant="caption" color={colors.textMuted}>
              Paid 15th & 30th · monthly estimate, not cash on hand
            </Text>
          ) : null}
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <Text variant="strong">{formatPHP(o.dueThisMonth)}</Text>
              <Text variant="caption" color={colors.textMuted}>
                Repayments due
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="strong">{formatPHP(o.spentThisMonth)}</Text>
              <Text variant="caption" color={colors.textMuted}>
                Bought this month
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="strong">{formatPHP(kept)}</Text>
              <Text variant="caption" color={colors.textMuted}>
                Kept by pausing
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <BudgetSetup />
      )}

      <Button
        label="Check a purchase"
        icon="search"
        kind="ink"
        onPress={() => router.push('/spend-check')}
      />

      {cooling.length > 0 && (
        <Section title="Cooling off">
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
                  iconBg={left ? colors.shell : colors.spendSoft}
                  iconFg={left ? colors.lagoon : colors.spend}
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

      <Section title="Recent">
        <Group>
          {recent.length ? (
            recent.map((p) => (
              <GroupRow
                key={p.id}
                leading={
                  <Avatar
                    label={p.item}
                    bg={p.status === 'skipped' ? '#F3ECE4' : colors.surfaceMuted}
                    fg={p.status === 'skipped' ? colors.success : colors.spend}
                  />
                }
                title={p.item}
                subtitle={`${STATUS[p.status]}${p.plannedDate ? ` · planned ${shortDate(p.plannedDate)}` : ''}`}
                value={formatPHP(p.price)}
                valueTone={p.status === 'skipped' ? colors.success : undefined}
              />
            ))
          ) : (
            <GroupRow
              icon="receipt"
              title="Nothing checked yet"
              subtitle="Before your next checkout, run it past me."
              onPress={() => router.push('/spend-check')}
            />
          )}
        </Group>
      </Section>

      <Section title="Tools">
        <Group>
          <GroupRow
            icon="calculator"
            title="Pay-later true cost"
            subtitle="See what installments really add up to"
            onPress={() => router.push('/spend-check')}
          />
          <GroupRow
            icon="chat"
            title="Ask Ginto"
            subtitle="“Can I afford ₱2,000 this week?”"
            onPress={() => router.push('/chat')}
          />
        </Group>
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

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  heroRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: spacing.xs,
  },
});
