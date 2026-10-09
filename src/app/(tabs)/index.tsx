import { router } from 'expo-router';

import { Button, Card, Placeholder, Screen, Text } from '@/components/ui';
import { colors } from '@/constants/theme';

export default function TodayScreen() {
  return (
    <Screen>
      <Text variant="title">Today</Text>
      <Text variant="muted">Small, intentional choices. No guilt about setbacks.</Text>

      <Placeholder phase="Phase 5">
        Wellness overview, pauses taken today, and one personalized recommendation.
      </Placeholder>

      <Card accent={colors.debt}>
        <Text variant="heading">Debt</Text>
        <Text variant="muted">Upcoming repayments and outstanding balances. (Phase 2)</Text>
      </Card>
      <Card accent={colors.spend}>
        <Text variant="heading">Spend</Text>
        <Text variant="muted">Planned purchases and items cooling off. (Phase 3)</Text>
      </Card>
      <Card accent={colors.scroll}>
        <Text variant="heading">Scroll</Text>
        <Text variant="muted">Today&apos;s sessions and breaks taken. (Phase 4)</Text>
      </Card>

      <Button
        label="How are you feeling?"
        onPress={() => router.push('/check-in')}
        kind="secondary"
      />
      <Button label="Help & Safety" onPress={() => router.push('/help')} kind="ghost" />
      <Button label="Privacy & Settings" onPress={() => router.push('/settings')} kind="ghost" />
    </Screen>
  );
}
