import { Placeholder, Screen, Text } from '@/components/ui';

export default function CheckInScreen() {
  return (
    <Screen>
      <Text variant="heading">How are you today?</Text>
      <Text variant="muted">
        Optional. Used only to soften the tone of suggestions — never to diagnose.
      </Text>
      <Placeholder phase="Phase 5">Stress, mood and mental-fatigue ratings (1–5).</Placeholder>
    </Screen>
  );
}
