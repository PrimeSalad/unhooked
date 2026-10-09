// The AI Pause: Trigger → Pause (real countdown) → Reflection → Recommendation → Decision.
// This is the product's core screen; see plan.md Phase 1 for the full contract.

import { router, useLocalSearchParams } from 'expo-router';

import { Button, Placeholder, Screen, Text } from '@/components/ui';
import type { PauseKind } from '@/domain/types';

const titles: Record<PauseKind, string> = {
  borrow: 'Before you borrow',
  checkout: 'Before you buy',
  scroll: 'Quick check-in',
};

export default function PauseScreen() {
  const { kind } = useLocalSearchParams<{ kind?: PauseKind }>();
  return (
    <Screen>
      <Text variant="title">{titles[kind ?? 'checkout'] ?? titles.checkout}</Text>
      <Placeholder phase="Phase 1">
        Countdown ring (settings.pauseSeconds), reflection from getReflectionProvider(), labeled
        facts/estimates, and Continue · Reconsider · Take a break · Save for later.
      </Placeholder>
      <Button label="Close" onPress={() => router.back()} kind="secondary" />
    </Screen>
  );
}
