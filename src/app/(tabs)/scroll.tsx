import { router } from 'expo-router';

import { Button, Placeholder, Screen, Text } from '@/components/ui';

export default function ScrollScreen() {
  return (
    <Screen>
      <Text variant="title">Scroll</Text>
      <Text variant="muted">Use your feed on purpose.</Text>
      <Placeholder phase="Phase 4">
        Start a session: pick app, set limit, get a gentle check-in.
      </Placeholder>
      <Placeholder phase="Phase 4">
        Habit insights: longest sessions, time-of-day pattern, breaks.
      </Placeholder>
      <Button
        label="Preview a scroll check-in"
        onPress={() => router.push({ pathname: '/pause', params: { kind: 'scroll' } })}
        kind="secondary"
      />
    </Screen>
  );
}
