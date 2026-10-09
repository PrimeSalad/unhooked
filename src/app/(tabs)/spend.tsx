import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';

import { BudgetSetup } from '@/components/BudgetSetup';
import { Icon } from '@/components/Icon';
import {
  Avatar,
  Button,
  Field,
  Group,
  GroupRow,
  LargeTitle,
  Screen,
  Section,
  Segmented,
  Sheet,
  Text,
} from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { emptyOverview, getOverview, listPurchases, setPurchaseStatus } from '@/db/repo';
import { useDbQuery } from '@/db/useDbQuery';
import { formatPHP } from '@/domain/money';
import { getMonthlyPosition } from '@/domain/monthlyPosition';
import type { PlannedPurchase } from '@/domain/types';
import { timeLeft } from '@/lib/format';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

const STATUS: Record<PlannedPurchase['status'], string> = {
  planned: 'Checked · ready to decide',
  cooling: 'Cooling off',
  bought: 'Bought',
  skipped: 'Skipped · money kept',
};

function DecideSheet({ p, onClose }: { p: PlannedPurchase | null; onClose: () => void }) {
  const db = useSQLiteContext();
  const showToast = useSession((s) => s.showToast);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  if (!p) return null;
  const left = p.coolingUntil ? timeLeft(p.coolingUntil) : null;
  const save = async (status: 'skipped' | 'bought') => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      await setPurchaseStatus(db, p.id, status);
      showToast(
        status === 'skipped'
          ? `${formatPHP(p.price)} kept. Decision saved.`
          : 'Purchase recorded in your monthly spending.',
      );
      onClose();
    } catch {
      setError('Your decision could not be saved. Please try again.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  return (
    <Sheet open onClose={() => !pending && onClose()}>
      <Text variant="eyebrow">{left ? 'Give it a little room' : 'Your call'}</Text>
      <Text variant="title">Still want {p.item}?</Text>
      <View style={styles.decisionAmount}>
        <Text variant="number">{formatPHP(p.price)}</Text>
        <Text variant="small">
          {left ??
            (p.coolingUntil
              ? 'Your cooling period is complete.'
              : 'You have checked this purchase.')}
        </Text>
      </View>
      <Text variant="small">
        {left
          ? 'You can wait a little longer, skip it, or record it if you have already bought it.'
          : 'Either way, keeping your records up to date gives you a clearer picture.'}
      </Text>
      {error ? (
        <Text variant="small" color={colors.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Button
        label="Skip it · keep the money"
        loading={pending}
        onPress={() => void save('skipped')}
      />
      <Button
        label="I bought it"
        kind="outline"
        disabled={pending}
        onPress={() => void save('bought')}
      />
      <Button
        label={left ? 'Keep cooling off' : 'Decide later'}
        kind="ghost"
        disabled={pending}
        onPress={onClose}
      />
    </Sheet>
  );
}

export default function SpendScreen() {
  const budget = useSettings((s) => s.budget);
  const overview = useDbQuery(getOverview, emptyOverview);
  const history = useDbQuery(listPurchases, []);
  const [deciding, setDeciding] = useState<PlannedPurchase | null>(null);
  const [filter, setFilter] = useState<'all' | 'planned' | 'done'>('all');
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [, refreshClock] = useState(0);
  const { width } = useWindowDimensions();
  const wide = width >= 1100;
  const o = overview.data;
  const purchases = history.data;
  const cooling = purchases.filter((p) => p.status === 'cooling');
  useEffect(() => {
    if (!cooling.length) return;
    const interval = setInterval(() => refreshClock((n) => n + 1), 30000);
    return () => clearInterval(interval);
  }, [cooling.length]);
  const recent = purchases.filter(
    (p) =>
      p.status !== 'cooling' &&
      p.item.toLowerCase().includes(search.trim().toLowerCase()) &&
      (filter === 'all' ||
        (filter === 'planned'
          ? p.status === 'planned'
          : p.status === 'bought' || p.status === 'skipped')),
  );
  const shown = showAll ? recent : recent.slice(0, 5);
  const kept = purchases.filter((p) => p.status === 'skipped').reduce((s, p) => s + p.price, 0);
  const position = getMonthlyPosition({
    budget,
    repayments: o.dueThisMonth,
    spent: o.spentThisMonth,
  });
  const positionCopy =
    position.band === 'short'
      ? `${formatPHP(position.repaymentGap)} of this month’s commitments still needs covering.`
      : position.band === 'tight'
        ? 'Your commitments fit, with a little room left. A pause before buying can help.'
        : 'Room for spending after your essentials, savings, repayments and recorded purchases.';

  return (
    <Screen>
      <LargeTitle eyebrow="A pause before the purchase" title="Spend with a clear head." />
      <Text color={colors.textSoft}>
        Know what fits your month. Give the things you want a little time.
      </Text>
      <View style={[styles.columns, wide && styles.columnsWide]}>
        <View style={{ flex: wide ? 1 : undefined, minWidth: 0, gap: spacing.xxl }}>
          {!overview.loaded ? (
            <ActivityIndicator color={colors.text} accessibilityLabel="Loading your budget" />
          ) : overview.error ? (
            <View style={styles.empty}>
              <Text color={colors.error}>Your budget picture could not be loaded.</Text>
              <Button label="Try again" kind="outline" onPress={overview.retry} />
            </View>
          ) : budget ? (
            <View style={styles.hero}>
              <View style={styles.heroTop}>
                <Icon name="wallet" color={colors.text} size={26} />
                <Text variant="eyebrow">Room this month</Text>
              </View>
              <Text variant="display" style={styles.heroAmount}>
                {formatPHP(position.safeToSpend)}
              </Text>
              <Text variant="small">{positionCopy}</Text>
              <Button
                label="Check a purchase"
                icon="search"
                onPress={() => router.push('/spend-check')}
              />
              <View style={styles.moneyPath}>
                <Text variant="caption" style={{ marginBottom: spacing.sm }}>
                  The numbers behind it
                </Text>
                <MoneyStep label="Monthly income" value={position.income} />
                <MoneyStep label="Bills + savings" value={-position.essentials} muted />
                <MoneyStep label="Repayments due" value={-position.repayments} muted />
                <MoneyStep label="Already bought" value={-position.spent} muted />
                <View style={styles.moneyRule} />
                <MoneyStep label="Available now" value={position.safeToSpend} strong />
              </View>
              <Text variant="caption">
                An estimate from the budget and purchases you have recorded.
              </Text>
              <Button
                label="Update my budget"
                kind="ghost"
                size="sm"
                onPress={() => router.push('/settings')}
              />
            </View>
          ) : (
            <>
              <BudgetSetup />
              <Button
                label="Check a purchase"
                icon="search"
                onPress={() => router.push('/spend-check')}
              />
            </>
          )}
          {kept > 0 && (
            <View style={styles.keptStrip}>
              <Icon name="leaf" color={colors.success} size={26} />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text variant="heading">{formatPHP(kept)} kept</Text>
                <Text variant="small">
                  From purchases you chose to skip. Small decisions add up.
                </Text>
              </View>
            </View>
          )}
          <Group>
            <GroupRow
              icon="calculator"
              title="The real cost of pay later"
              subtitle="Check the full price behind the installments"
              onPress={() => router.push('/spend-check')}
            />
          </Group>
        </View>
        <View style={{ flex: wide ? 1.15 : undefined, minWidth: 0, gap: spacing.xxl }}>
          {cooling.length > 0 && (
            <Section title="Give it a day">
              <Text variant="small">
                A little distance from the checkout. Tap a purchase when you are ready.
              </Text>
              <Group>
                {cooling.map((p) => {
                  const left = p.coolingUntil ? timeLeft(p.coolingUntil) : null;
                  return (
                    <GroupRow
                      key={p.id}
                      icon="hourglass"
                      iconBg={colors.spendSoft}
                      iconFg={colors.spend}
                      title={p.item}
                      subtitle={left ?? 'Ready for your decision'}
                      value={formatPHP(p.price)}
                      onPress={() => setDeciding(p)}
                    />
                  );
                })}
              </Group>
            </Section>
          )}
          <Section title="Your purchase journal">
            {purchases.some((p) => p.status !== 'cooling') && (
              <>
                <Segmented
                  value={filter}
                  onChange={(v) => {
                    setFilter(v);
                    setShowAll(false);
                  }}
                  options={[
                    { value: 'all', label: 'All' },
                    { value: 'planned', label: 'To decide' },
                    { value: 'done', label: 'Decided' },
                  ]}
                />
                {purchases.length > 5 && (
                  <Field
                    label="Find a purchase"
                    placeholder="Search your items"
                    value={search}
                    onChangeText={setSearch}
                  />
                )}
              </>
            )}
            {!history.loaded ? (
              <ActivityIndicator color={colors.text} accessibilityLabel="Loading purchases" />
            ) : history.error ? (
              <View style={styles.empty}>
                <Text color={colors.error}>Your purchases could not be loaded.</Text>
                <Button label="Try again" kind="outline" onPress={history.retry} />
              </View>
            ) : shown.length ? (
              <Group>
                {shown.map((p) => (
                  <GroupRow
                    key={p.id}
                    leading={
                      <Avatar
                        label={p.item}
                        bg={colors.surfaceMuted}
                        fg={p.status === 'skipped' ? colors.success : colors.text}
                      />
                    }
                    title={p.item}
                    subtitle={STATUS[p.status]}
                    value={formatPHP(p.price)}
                    valueTone={p.status === 'skipped' ? colors.success : undefined}
                    onPress={p.status === 'planned' ? () => setDeciding(p) : undefined}
                  />
                ))}
              </Group>
            ) : (
              <View style={styles.empty}>
                <Icon name="receipt" color={colors.textMuted} size={30} />
                <Text variant="heading">
                  {purchases.length
                    ? 'No purchases in this view.'
                    : 'Your next purchase starts here.'}
                </Text>
                <Text variant="small">
                  {purchases.length
                    ? 'Try another filter or a different search.'
                    : 'Check something you are thinking about buying. Your decisions will live here.'}
                </Text>
                {!purchases.length && (
                  <Button
                    label="Check my first purchase"
                    kind="outline"
                    size="sm"
                    onPress={() => router.push('/spend-check')}
                  />
                )}
              </View>
            )}
            {recent.length > 5 && (
              <Button
                label={showAll ? 'Show fewer purchases' : `See all ${recent.length} purchases`}
                kind="ghost"
                size="sm"
                onPress={() => setShowAll(!showAll)}
              />
            )}
          </Section>
        </View>
      </View>
      <DecideSheet key={deciding?.id ?? 'none'} p={deciding} onClose={() => setDeciding(null)} />
    </Screen>
  );
}

function MoneyStep({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: number;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <View style={styles.moneyRow}>
      <Text
        variant={strong ? 'strong' : 'small'}
        color={muted ? colors.textMuted : colors.text}
        style={{ flex: 1 }}
      >
        {label}
      </Text>
      <Text variant="strong" color={strong ? colors.text : colors.textSoft}>
        {value < 0 ? '−' : ''}
        {formatPHP(Math.abs(value))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  columns: { gap: spacing.xxl },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xxxl },
  hero: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    gap: spacing.lg,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroAmount: { fontSize: 44, lineHeight: 56, letterSpacing: -1.5 },
  moneyPath: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  moneyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  moneyRule: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  keptStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  empty: {
    paddingVertical: spacing.xxl,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  decisionAmount: {
    paddingVertical: spacing.lg,
    gap: spacing.xs,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
});
