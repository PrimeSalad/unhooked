import { Linking } from 'react-native';

import { Card, Screen, Text } from '@/components/ui';
import { DISCLAIMER, SUPPORT_RESOURCES } from '@/constants/resources';

export default function HelpScreen() {
  return (
    <Screen>
      <Text variant="muted">If you are in danger or thinking of harming yourself, call now.</Text>
      {SUPPORT_RESOURCES.map((r) => (
        <Card key={r.name}>
          <Text variant="heading">{r.name}</Text>
          <Text
            accessibilityRole="link"
            onPress={() => {
              const target = r.dial ? `tel:${r.dial}` : r.url;
              if (target) void Linking.openURL(target);
            }}
          >
            {r.contact}
          </Text>
        </Card>
      ))}
      <Text variant="muted">{DISCLAIMER}</Text>
    </Screen>
  );
}
