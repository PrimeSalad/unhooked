// Past daily check-ins: a 7-day mood line and one row per day. Stays on this phone.

import { router } from 'expo-router';

import { CheckInRow, MoodChart } from '@/components/CheckInHistoryCards';
import { EmptyState, Group, Screen, ScreenHeader, Section, Tag, Text } from '@/components/ui';
import { listCheckIns } from '@/db/checkins';
import { latestCheckIn } from '@/db/repo';
import { useDbQuery } from '@/db/useDbQuery';

export default function CheckInHistoryScreen() {
  const { data: checkIns, loaded } = useDbQuery(listCheckIns, []);
  const { data: today } = useDbQuery(latestCheckIn, null);

  return (
    <Screen tabs={false}>
      <ScreenHeader back title="Check-ins" />

      {!loaded ? null : checkIns.length === 0 ? (
        <EmptyState
          mood="curious"
          title="No check-ins yet"
          body="Rate your mood, stress and tiredness once a day. Your history shows up here."
          action="Check in now"
          onAction={() => router.replace('/check-in')}
        />
      ) : (
        <>
          <MoodChart checkIns={checkIns} />

          <Section
            title={`${checkIns.length} ${checkIns.length === 1 ? 'day' : 'days'}`}
            action={today ? undefined : 'Check in today'}
            onAction={() => router.replace('/check-in')}
          >
            <Group>
              {checkIns.map((c) => (
                <CheckInRow key={c.id} checkIn={c} />
              ))}
            </Group>
          </Section>

          <Tag certainty="estimate" />
          <Text variant="caption">
            The day&apos;s label is an estimate from your three answers. Ratings are out of 5; for
            stress and tired, higher is heavier.
          </Text>
        </>
      )}
    </Screen>
  );
}
