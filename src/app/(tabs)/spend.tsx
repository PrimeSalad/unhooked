import { router } from 'expo-router';

import { Button, Placeholder, Screen, Text } from '@/components/ui';

export default function SpendScreen() {
  return (
    <Screen>
      <Text variant="title">Spend</Text>
      <Text variant="muted">Check it before you check out.</Text>
      <Placeholder phase="Phase 3">Purchase planner: item, price, need vs want, date.</Placeholder>
      <Placeholder phase="Phase 3">
        Affordability check against budget and upcoming repayments.
      </Placeholder>
      <Placeholder phase="Phase 3">BNPL true-cost calculator.</Placeholder>
      <Placeholder phase="Phase 3">24-hour cooling list with reminders.</Placeholder>
      <Button
        label="I'm about to buy something"
        onPress={() => router.push({ pathname: '/pause', params: { kind: 'checkout' } })}
      />
    </Screen>
  );
}
