// Help & Safety: official hotlines and where to report, one tap from Today, Debt and Settings.

import { Linking } from 'react-native';

import { Group, GroupRow, Screen, ScreenHeader, Section, Text } from '@/components/ui';
import { DISCLAIMER, SUPPORT_RESOURCES, type SupportResource } from '@/constants/resources';

const open = (r: SupportResource) => {
  const target = r.dial ? `tel:${r.dial}` : r.url;
  if (target) void Linking.openURL(target);
};

function Row({ r }: { r: SupportResource }) {
  return (
    <GroupRow
      icon={r.dial ? 'phone' : 'open'}
      title={r.name}
      subtitle={r.contact}
      onPress={() => open(r)}
    />
  );
}

export default function HelpScreen() {
  const urgent = SUPPORT_RESOURCES.filter((r) => r.purpose === 'crisis');
  const report = SUPPORT_RESOURCES.filter((r) => r.purpose !== 'crisis');

  return (
    <Screen tabs={false}>
      <ScreenHeader back title="Help and safety" subtitle="Real people you can reach today." />

      <Section title="If you feel unsafe">
        <Group>
          {urgent.map((r) => (
            <Row key={r.name} r={r} />
          ))}
        </Group>
      </Section>

      <Section title="Report harassment">
        <Group>
          {report.map((r) => (
            <Row key={r.name} r={r} />
          ))}
        </Group>
      </Section>

      <Text variant="caption" style={{ lineHeight: 18 }}>
        {DISCLAIMER}
      </Text>
    </Screen>
  );
}
