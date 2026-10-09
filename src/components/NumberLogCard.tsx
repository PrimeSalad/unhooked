import { View } from 'react-native';

import { Card, IconButton, Tag, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import type { NumberSummary } from '@/domain/numberLog';

export function NumberLogCard({
  summary,
  onRemove,
}: {
  summary: NumberSummary;
  onRemove: () => void;
}) {
  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="strong" selectable>
            {summary.number}
          </Text>
          <Text variant="small">{summary.agentName || 'Agent name not recorded'}</Text>
        </View>
        <IconButton icon="trash" label={`Remove ${summary.number} from log`} onPress={onRemove} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Tag certainty="fact" label="Your report" />
        <Text variant="caption" color={colors.textMuted}>
          Last seen {summary.lastSeenOn} · {summary.reports} saved{' '}
          {summary.reports === 1 ? 'report' : 'reports'}
        </Text>
      </View>
    </Card>
  );
}
