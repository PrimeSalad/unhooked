import { router } from 'expo-router';

import { Button, Placeholder, Screen, Text } from '@/components/ui';

export default function DebtScreen() {
  return (
    <Screen>
      <Text variant="title">Debt</Text>
      <Text variant="muted">What you owe, what you&apos;re owed, and a plan that fits.</Text>
      <Placeholder phase="Phase 2">
        Owed / Lent tracker with partial payments and due dates.
      </Placeholder>
      <Placeholder phase="Phase 2">
        Repayment planner (due date · avalanche · snowball).
      </Placeholder>
      <Placeholder phase="Phase 2">
        Debt Evidence Pack: screenshots by lender/date, export as PDF.
      </Placeholder>
      <Button
        label="I'm thinking of borrowing"
        onPress={() => router.push({ pathname: '/pause', params: { kind: 'borrow' } })}
      />
      <Button
        label="Check a suspicious message"
        onPress={() => router.push('/message-check')}
        kind="secondary"
      />
    </Screen>
  );
}
