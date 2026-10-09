import { Placeholder, Screen, Text } from '@/components/ui';

export default function MessageCheckScreen() {
  return (
    <Screen>
      <Text variant="muted">
        Paste a message from a lender or collector. We check it on your phone for warning signs.
      </Text>
      <Placeholder phase="Phase 6">
        Paste box → risk level + highlighted signals → save to Evidence Pack · block/report
        guidance.
      </Placeholder>
    </Screen>
  );
}
