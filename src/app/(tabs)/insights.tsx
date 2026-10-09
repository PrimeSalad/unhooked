import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';

import { buildInsights } from '@/ai/insights';
import { ActionError } from '@/components/FlowLayout';
import { Icon } from '@/components/Icon';
import {
  Button,
  EmptyState,
  Group,
  GroupRow,
  LargeTitle,
  Row,
  Screen,
  Section,
  Tag,
  Text,
} from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { dodgedLast7Days, emptyOverview, getOverview } from '@/db/repo';
import { useDbQuery } from '@/db/useDbQuery';

const BAR_MAX = 120;
const MODULE = {
  debt: {
    label: 'Money & repayments',
    color: colors.debt,
    action: 'Review my balances',
    route: '/debt',
  },
  spend: {
    label: 'Spending decisions',
    color: colors.spend,
    action: 'Open my purchase journal',
    route: '/spend',
  },
  scroll: {
    label: 'Time & attention',
    color: colors.scroll,
    action: 'Review my boundaries',
    route: '/scroll',
  },
  overall: {
    label: 'Looking after yourself',
    color: colors.text,
    action: 'Take a moment',
    route: '/break',
  },
} as const;

export default function InsightsScreen() {
  const overview = useDbQuery(getOverview, emptyOverview);
  const activity = useDbQuery(dodgedLast7Days, []);
  const { width } = useWindowDimensions();
  const wide = width >= 1100;
  const week = activity.data;
  const insights = buildInsights(overview.data);
  const max = Math.max(1, ...week.map((d) => d.n));
  const total = week.reduce((a, d) => a + d.n, 0);
  const firstDay = week[0]?.date;
  const lastDay = week[week.length - 1]?.date;
  const dateRange =
    firstDay && lastDay
      ? `${firstDay.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} – ${lastDay.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`
      : 'Last seven days';

  return (
    <Screen>
      <LargeTitle eyebrow="A little perspective" title="Notice what’s changing." />
      <Text color={colors.textSoft}>
        A weekly look at the choices you have recorded. No scores. No judgment.
      </Text>
      <View style={[styles.columns, wide && styles.columnsWide]}>
        <View style={{ flex: wide ? 1 : undefined, minWidth: 0, gap: spacing.xxl }}>
          <View style={styles.chartPanel}>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <Text variant="eyebrow">Your week</Text>
              <Text variant="caption">{dateRange}</Text>
            </Row>
            {!activity.loaded ? (
              <ActivityIndicator
                color={colors.text}
                accessibilityLabel="Loading your weekly activity"
              />
            ) : activity.error ? (
              <ActionError
                message="Your weekly activity could not be loaded."
                onRetry={activity.retry}
              />
            ) : (
              <>
                <View style={styles.totalRow}>
                  <Text variant="display" style={{ fontSize: 60, lineHeight: 70 }}>
                    {total}
                  </Text>
                  <Text variant="small" style={{ maxWidth: 170, paddingBottom: spacing.md }}>
                    {total === 1 ? 'hook dodged' : 'hooks dodged'} in the last seven days
                  </Text>
                </View>
                <View
                  style={styles.chart}
                  accessibilityRole="summary"
                  accessibilityLabel={`Hooks dodged: ${week.map((d) => `${d.date.toLocaleDateString('en-PH', { weekday: 'long' })}, ${d.n}`).join('; ')}`}
                >
                  {week.map((d, i) => {
                    const today = i === week.length - 1;
                    return (
                      <View key={d.date.toISOString()} style={styles.barColumn}>
                        <View style={styles.barSpace}>
                          <Text variant="caption" color={colors.text}>
                            {d.n}
                          </Text>
                          <View
                            style={[
                              styles.bar,
                              {
                                height: Math.max(3, (d.n / max) * BAR_MAX),
                                backgroundColor: today
                                  ? colors.primary
                                  : d.n
                                    ? colors.text
                                    : colors.border,
                              },
                            ]}
                          />
                        </View>
                        <Text variant="caption" color={today ? colors.text : colors.textMuted}>
                          {d.date.toLocaleDateString('en-PH', { weekday: 'short' }).slice(0, 2)}
                        </Text>
                        <Text variant="caption" color={today ? colors.text : colors.textMuted}>
                          {d.date.getDate()}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                <Text variant="small">
                  {total > 0
                    ? 'Times you chose to wait, reconsider, or take a break during a pause.'
                    : 'No pause decisions recorded yet. Your first pause is a place to begin.'}
                </Text>
              </>
            )}
          </View>
          <View style={styles.explanation}>
            <Icon name="lock" color={colors.textMuted} size={22} />
            <Text variant="small" style={{ flex: 1 }}>
              These reflections use the activity saved on this device. Estimates are labeled, and
              missing activity stays missing.
            </Text>
          </View>
          <Section title="Keep a good thing going">
            <Group>
              <GroupRow
                icon="search"
                title="Think through a purchase"
                subtitle="A clearer decision before you check out"
                onPress={() => router.push('/spend-check')}
              />
              <GroupRow
                icon="leaf"
                title="Take a small break"
                subtitle="A little room to reset your attention"
                onPress={() => router.push('/break')}
              />
            </Group>
          </Section>
        </View>
        <View style={{ flex: wide ? 1.1 : undefined, minWidth: 0, gap: spacing.xl }}>
          <Section title="What your records tell us">
            {!overview.loaded ? (
              <ActivityIndicator
                color={colors.text}
                accessibilityLabel="Loading your reflections"
              />
            ) : overview.error ? (
              <ActionError
                message="Your reflections could not be loaded."
                onRetry={overview.retry}
              />
            ) : insights.length === 0 ? (
              <EmptyState
                mood="thinking"
                title="Your rhythm will show up here."
                body="Add a balance, check something you want to buy, or start a scroll timer. Your own records will bring this page to life."
                action="Start with a purchase check"
                onAction={() => router.push('/spend-check')}
              />
            ) : (
              insights.map((n) => (
                <View key={n.id} style={styles.insight}>
                  <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <Text variant="caption" color={MODULE[n.module].color}>
                      {MODULE[n.module].label}
                    </Text>
                    <Tag certainty={n.certainty} />
                  </Row>
                  <Text variant="heading" style={{ fontSize: 19, lineHeight: 29 }}>
                    {n.text}
                  </Text>
                  <Button
                    label={MODULE[n.module].action}
                    kind="ghost"
                    size="sm"
                    icon="arrow-forward"
                    onPress={() => router.push(MODULE[n.module].route)}
                    style={{ alignSelf: 'flex-start' }}
                  />
                </View>
              ))
            )}
          </Section>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  columns: { gap: spacing.xxl },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xxxl },
  chartPanel: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    gap: spacing.lg,
  },
  totalRow: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: spacing.lg },
  chart: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingBottom: spacing.md,
  },
  barColumn: { flex: 1, alignItems: 'center', gap: spacing.xs, minWidth: 0 },
  barSpace: {
    height: BAR_MAX + 30,
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.xs,
    width: '100%',
  },
  bar: { width: '70%', maxWidth: 38, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  explanation: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  insight: {
    paddingVertical: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
});
