import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { localDateKey } from '@/lib/dateOnly';

export interface PlannedDatePickerProps {
  value: string;
  onChange: (value: string) => void;
}

/** Browsers provide their own calendar popover for a date input. */
export function PlannedDatePicker({ value, onChange }: PlannedDatePickerProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text variant="caption" color={colors.textSoft} style={{ fontFamily: fonts.semibold }}>
        Planned purchase date (optional)
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <input
          type="date"
          aria-label="Planned purchase date"
          min={localDateKey(new Date())}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          style={{
            flex: 1,
            minWidth: 0,
            height: 52,
            boxSizing: 'border-box',
            border: `1.5px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: `0 ${spacing.lg}px`,
            backgroundColor: colors.surface,
            color: colors.text,
            fontFamily: fonts.medium,
            fontSize: 16,
          }}
        />
        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear planned purchase date"
            onPress={() => onChange('')}
            style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm }}
          >
            <Text variant="small" color={colors.link}>
              Clear
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
