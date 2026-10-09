import { useSQLiteContext } from 'expo-sqlite';
import { View } from 'react-native';

import { buildEventInsights, buildInsights, visibleInsights } from '@/ai/insights';
import { InsightCard } from '@/components/InsightCard';
import { Card, EmptyState, Rise, Row, Screen, ScreenHeader, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { recentEvents } from '@/db/events';
import { dismissInsight } from '@/db/insights';
import { dodgedLast7Days, emptyOverview, getOverview } from '@/db/repo';
import { useDbQuery } from '@/db/useDbQuery';
import { summarizeActivity } from '@/domain/activity';
import { useSession } from '@/store/session';

const BAR_MAX = 84;

export default function InsightsScreen() {
  const db = useSQLiteContext();
  const showToast = useSession((s) => s.showToast);
  const { data: o } = useDbQuery(getOverview, emptyOverview);
  const { data: week } = useDbQuery(dodgedLast7Days, []);
  const { data: events, loaded: eventsLoaded } = useDbQuery(recentEvents, []);
  const activity = summarizeActivity(events);
  const insights = eventsLoaded
    ? visibleInsights([...buildEventInsights(activity), ...buildInsights(o)], activity.dismissedIds)
    : [];
  const max = Math.max(1, ...week.map((d) => d.n));
  const total = week.reduce((a, d) => a + d.n, 0);
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

      {eventsLoaded && insights.length === 0 ? (
        <EmptyState
          mood="thinking"
          title="Nothing else to show right now"
          body="Hidden insights return after 7 days. New activity can bring new patterns sooner."
        />
      ) : (
        insights.map((n, i) => (
          <Rise key={n.id} delay={60 * (i + 1)}>
            <InsightCard insight={n} onDismiss={(id) => void hideInsight(id)} />
          </Rise>
        ))
      )}
    </Screen>
  );
}
