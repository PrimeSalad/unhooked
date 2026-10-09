import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Button, Sheet, Text } from '@/components/ui';
import type { PlannedDatePickerProps } from '@/components/PlannedDatePicker';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { dateFromKey, localDateKey } from '@/lib/dateOnly';
import { shortDate } from '@/lib/format';

export function PlannedDatePicker({ value, onChange }: PlannedDatePickerProps) {
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState(new Date());
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selected = dateFromKey(value);
  const initialDate = selected && selected >= today ? selected : today;

  const openPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initialDate,
        mode: 'date',
        minimumDate: today,
        onValueChange: (_event, date) => onChange(localDateKey(date)),
      });
      return;
    }
    setDraft(initialDate);
    setIosOpen(true);
  };

  return (
    <View style={{ gap: 6 }}>
      <Text variant="caption" color={colors.textSoft} style={{ fontFamily: fonts.semibold }}>
        Planned purchase date (optional)
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose planned purchase date"
          onPress={openPicker}
          style={{
            flex: 1,
            minHeight: 52,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            borderWidth: 1.5,
            borderColor: colors.border,
            paddingHorizontal: spacing.lg,
            justifyContent: 'center',
          }}
        >
          <Text variant="strong" color={value ? colors.text : colors.textFaint}>
            {value ? `${shortDate(value)}, ${value.slice(0, 4)}` : 'Choose a date'}
          </Text>
        </Pressable>
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
      {Platform.OS === 'ios' ? (
        <Sheet open={iosOpen} onClose={() => setIosOpen(false)}>
          <Text variant="heading">Choose purchase date</Text>
          <DateTimePicker
            value={draft}
            mode="date"
            display="spinner"
            minimumDate={today}
            onValueChange={(_event, date) => setDraft(date)}
          />
          <Button
            label="Use this date"
            onPress={() => {
              onChange(localDateKey(draft));
              setIosOpen(false);
            }}
          />
        </Sheet>
      ) : null}
    </View>
  );
}
