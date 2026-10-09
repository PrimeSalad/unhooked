import { View } from 'react-native';

import { buildInsights } from '@/ai/insights';
import { Card, EmptyState, Rise, Row, Screen, ScreenHeader, Tag, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { dodgedLast7Days, emptyOverview, getOverview } from '@/db/repo';
import { useDbQuery } from '@/db/useDbQuery';

const BAR_MAX = 84;
const MODULE = {
  debt: { label: 'Debt', color: colors.debt },
  spend: { label: 'Spend', color: colors.spend },
  scroll: { label: 'Scroll', color: colors.scroll },
  overall: { label: 'You', color: colors.text },
} as const;

export default function InsightsScreen() {
  const { data: o } = useDbQuery(getOverview, emptyOverview);
  const { data: week } = useDbQuery(dodgedLast7Days, []);
  const insights = buildInsights(o);
  const max = Math.max(1, ...week.map((d) => d.n));
  const total = week.reduce((a, d) => a + d.n, 0);

  return (
    <Screen>
      <ScreenHeader
        back
        title="Your week"
        subtitle="From your own activity. Patterns, not judgments."
        mascot="thinking"
      />

      <Rise>
        <Card style={{ gap: spacing.lg }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="strong">Hooks dodged, last 7 days</Text>
            <Text variant="heading" style={{ fontSize: 22 }}>
              {total}
            </Text>
          </Row>
          <Row gap={spacing.sm} style={{ alignItems: 'flex-end', height: BAR_MAX + 44 }}>
            {week.map((d, i) => {
              const today = i === week.length - 1;
              return (
                <View key={d.date.toISOString()} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                  <Text variant="caption" color={today ? colors.text : colors.textMuted}>
                    {d.n}
                  </Text>
                  <View
                    style={{
                      width: '100%',
                      height: Math.max(6, (d.n / max) * BAR_MAX),
                      borderTopLeftRadius: 8,
                      borderTopRightRadius: 8,
                      borderBottomLeftRadius: 4,
                      borderBottomRightRadius: 4,
                      backgroundColor: d.n ? (today ? colors.text : colors.accent) : colors.track,
                    }}
                  />
                  <Text variant="caption">{'SMTWTFS'[d.date.getDay()]}</Text>
                </View>
              );
            })}
          </Row>
        </Card>
      </Rise>

      {insights.length === 0 ? (
        <EmptyState
          mood="thinking"
          title="Still learning your rhythm"
          body="Add a debt, check a purchase or track a scroll session. Insights from your own data show up here."
        />
      ) : (
        insights.map((n, i) => (
          <Rise key={n.id} delay={60 * (i + 1)}>
            <Card>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="caption" color={MODULE[n.module].color} style={{ fontSize: 13 }}>
                  {MODULE[n.module].label}
                </Text>
                <Tag certainty={n.certainty} />
              </Row>
              <Text>{n.text}</Text>
            </Card>
          </Rise>
        ))
      )}
    </Screen>
  );
}
