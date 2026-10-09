import { Placeholder, Screen, Text } from '@/components/ui';

export default function InsightsScreen() {
  return (
    <Screen>
      <Text variant="title">Insights</Text>
      <Text variant="muted">Patterns from your own activity, labeled as estimates.</Text>
      <Placeholder phase="Phase 5">Daily summary generated from the local event log.</Placeholder>
      <Placeholder phase="Phase 5">Dismissible debt / spend / scroll insights.</Placeholder>
    </Screen>
  );
}
