import { View } from 'react-native';

import { Card, Rise, Row, Screen, ScreenHeader, Tag, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { demoInsights, demoWeekPauses } from '@/demo/ana';
import { useSession } from '@/store/session';

// Last 7 days, ending today.
const DAYS = Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - 6 + i);
  return 'SMTWTFS'[d.getDay()];
});
const BAR_MAX = 84;

export default function InsightsScreen() {
  const pauses = useSession((s) => s.pauses);
  const week = [...demoWeekPauses, pauses];
  const max = Math.max(1, ...week);
  const total = week.reduce((a, b) => a + b, 0);

  return (
    <Screen>
      <ScreenHeader
        title="Insights"
        subtitle="From your own activity. Patterns, not judgments."
        mascot="thinking"
      />

      <Rise>
        <Card style={{ gap: spacing.lg }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="strong">Pauses, last 7 days</Text>
            <Text variant="heading" style={{ fontSize: 22 }}>
              {total}
            </Text>
          </Row>
          <Row gap={spacing.sm} style={{ alignItems: 'flex-end', height: BAR_MAX + 44 }}>
            {week.map((v, i) => {
              const today = i === week.length - 1;
              return (
                <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                  <Text variant="caption" color={today ? colors.text : colors.textMuted}>
                    {v}
                  </Text>
                  <View
                    style={{
                      width: '100%',
                      height: Math.max(6, (v / max) * BAR_MAX),
                      borderTopLeftRadius: 8,
                      borderTopRightRadius: 8,
                      borderBottomLeftRadius: 4,
                      borderBottomRightRadius: 4,
                      backgroundColor: today ? colors.text : colors.accent,
                    }}
                  />
                  <Text variant="caption">{DAYS[i]}</Text>
                </View>
              );
            })}
          </Row>
        </Card>
      </Rise>

      {demoInsights.map((n, i) => (
        <Rise key={n.module} delay={60 * (i + 1)}>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="caption" color={n.color} style={{ fontSize: 13 }}>
                {n.module}
              </Text>
              <Tag certainty={n.certainty} />
            </Row>
            <Text>{n.text}</Text>
          </Card>
        </Rise>
      ))}
    </Screen>
  );
}
