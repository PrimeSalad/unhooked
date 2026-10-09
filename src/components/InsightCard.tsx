import { View } from 'react-native';

import type { Insight } from '@/ai/types';
import { colors, spacing } from '@/constants/theme';

import { Card, IconButton, Row, Tag, Text } from './ui';

const MODULE = {
  debt: 'Debt',
  spend: 'Spend',
  scroll: 'Scroll',
  overall: 'Today',
} as const;

export function InsightCard({
  insight,
  onDismiss,
}: {
  insight: Insight;
  onDismiss: (id: string) => void;
}) {
  const label = MODULE[insight.module];
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="caption" color={colors.text} style={{ fontSize: 13 }}>
          {label}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Tag certainty={insight.certainty} />
          <IconButton
            icon="close"
            label={`Hide ${label} insight for 7 days`}
            onPress={() => onDismiss(insight.id)}
            tone={colors.surfaceMuted}
          />
        </View>
      </Row>
      <Text>{insight.text}</Text>
    </Card>
  );
}
