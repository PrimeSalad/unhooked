import { router } from 'expo-router';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckInRecord, MoodChart } from '@/components/CheckInHistoryCards';
import { EmptyState, ScreenHeader, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { listCheckIns } from '@/db/checkins';
import { useDbQuery } from '@/db/useDbQuery';

export default function CheckInHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { data: checkIns, loaded } = useDbQuery(listCheckIns, []);

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      data={checkIns}
      keyExtractor={(checkIn) => checkIn.id}
      renderItem={({ item }) => <CheckInRecord checkIn={item} />}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.lg,
        paddingHorizontal: spacing.xl,
        paddingBottom: insets.bottom + spacing.xxxl,
        flexGrow: 1,
      }}
      ListHeaderComponent={
        <View style={{ gap: spacing.lg, marginBottom: spacing.lg }}>
          <ScreenHeader
            back
            title="Check-in history"
            subtitle="Your saved daily ratings over time."
          />
          {checkIns[0] ? (
            <>
              <MoodChart checkIns={checkIns} latest={checkIns[0]} />
              <View style={{ gap: spacing.xs }}>
                <Text variant="heading">Daily records</Text>
                <Text variant="caption">
                  Overall feeling uses all three answers. Mood: 1 low, 5 great · Stress: 1 calm, 5
                  very stressed · Fatigue: 1 fresh, 5 drained
                </Text>
              </View>
            </>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        loaded ? (
          <EmptyState
            mood="curious"
            title="No check-ins yet"
            body="Your daily mood, stress and fatigue ratings will appear here after you save a check-in."
            action="Check in today"
            onAction={() => router.push('/check-in')}
          />
        ) : (
          <ActivityIndicator color={colors.primary} />
        )
      }
      showsVerticalScrollIndicator={false}
    />
  );
}
