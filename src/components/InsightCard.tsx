import { Pressable, View } from 'react-native';

import type { Insight } from '@/ai/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

import { Icon } from './Icon';
import { Tag, Text } from './ui';

const MODULE = {
  debt: 'Debt',
  spend: 'Spend',
  scroll: 'Scroll',
  overall: 'Today',
} as const;

/** One insight: where it is from, how sure it is, the line itself, and a quiet way to hide it. */
export function InsightCard({
  insight,
  onDismiss,
}: {
  insight: Insight;
  onDismiss: (id: string) => void;
}) {
  const label = MODULE[insight.module];
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: spacing.md,
        paddingLeft: spacing.lg,
        paddingRight: spacing.md,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text variant="caption" color={colors.textSoft} style={{ fontFamily: fonts.semibold }}>
          {label}
        </Text>
        <Tag certainty={insight.certainty} />
        <View style={{ flex: 1 }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Hide ${label} insight for 7 days`}
          onPress={() => onDismiss(insight.id)}
          hitSlop={12}
          style={({ pressed }) => ({ padding: 4, opacity: pressed ? 0.5 : 1 })}
        >
          <Icon name="close" size={16} color={colors.textFaint} />
        </Pressable>
      </View>
      <Text style={{ paddingRight: spacing.sm }}>{insight.text}</Text>
    </View>
  );
}
