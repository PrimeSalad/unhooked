import { Linking, View } from 'react-native';

import { Button, ListRow, Screen, ScreenHeader, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { DISCLAIMER, SUPPORT_RESOURCES } from '@/constants/resources';

const open = (dial?: string, url?: string) => {
  const target = dial ? `tel:${dial}` : url;
  if (target) void Linking.openURL(target);
};

export default function HelpScreen() {
  const crisis = SUPPORT_RESOURCES.find((r) => r.purpose === 'crisis');
  const others = SUPPORT_RESOURCES.filter((r) => r !== crisis);

  return (
    <Screen tabs={false}>
      <ScreenHeader
        back
        title="Help and safety"
        subtitle="Real people, one tap away."
        mascot="brave"
      />

      {crisis && (
        <View
          style={{
            backgroundColor: colors.text,
            borderRadius: radius.xl,
            padding: spacing.xl,
            gap: spacing.sm,
          }}
        >
          <Text variant="eyebrow" color={colors.accent} style={{ fontSize: 11 }}>
            If you feel unsafe
          </Text>
          <Text variant="heading" color={colors.bg}>
            {crisis.name}
          </Text>
          <Text variant="small" color="#D9BFA8">
            {crisis.contact}
          </Text>
          <Button
            label={`Call ${crisis.dial}`}
            icon="call-outline"
            style={{ marginTop: spacing.sm }}
            onPress={() => open(crisis.dial, crisis.url)}
          />
        </View>
      )}

      {others.map((r) => (
        <ListRow
          key={r.name}
          icon={r.dial ? 'call-outline' : 'open-outline'}
          iconBg={colors.surfaceMuted}
          iconFg={colors.spend}
          title={r.name}
          subtitle={r.contact}
          onPress={() => open(r.dial, r.url)}
        />
      ))}

      <Text variant="caption" style={{ lineHeight: 18 }}>
        {DISCLAIMER}
      </Text>
    </Screen>
  );
}
