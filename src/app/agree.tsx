// First screen before anything else: the short version of the Privacy Policy and Terms of Use,
// links to both in full, and one clear agreement. Shown again when LEGAL_VERSION changes.

import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Button, Card, Screen, ScreenHeader, Text } from '@/components/ui';
import { LEGAL_SUMMARY, LEGAL_VERSION } from '@/constants/legal';
import { colors, radius, spacing } from '@/constants/theme';
import { useSettings } from '@/store/settings';

export default function AgreeScreen() {
  const setAccepted = useSettings((s) => s.setAcceptedTermsVersion);
  const [checked, setChecked] = useState(false);

  const agree = () => {
    setAccepted(LEGAL_VERSION);
    router.replace('/');
  };

  return (
    <Screen tabs={false}>
      <ScreenHeader title="Before you start" subtitle="How Unhooked treats you and your data." />

      <Card style={{ gap: spacing.md }}>
        {LEGAL_SUMMARY.map((line) => (
          <View key={line} style={styles.point}>
            <Icon name="check" size={18} color={colors.primary} />
            <Text variant="small" style={{ flex: 1 }}>
              {line}
            </Text>
          </View>
        ))}
      </Card>

      <View style={styles.links}>
        <Pressable accessibilityRole="link" onPress={() => router.push('/legal?doc=privacy')}>
          <Text variant="small" color={colors.primary}>
            Read the Privacy Policy
          </Text>
        </Pressable>
        <Pressable accessibilityRole="link" onPress={() => router.push('/legal?doc=terms')}>
          <Text variant="small" color={colors.primary}>
            Read the Terms of Use
          </Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={() => setChecked(!checked)}
        style={styles.point}
      >
        <View style={[styles.box, checked && styles.boxOn]}>
          {checked ? <Icon name="check" size={16} color={colors.white} /> : null}
        </View>
        <Text variant="small" style={{ flex: 1 }}>
          I am 18 or older, and I agree to the Terms of Use and Privacy Policy.
        </Text>
      </Pressable>

      <View style={{ flex: 1 }} />
      <Button label="Agree and continue" disabled={!checked} onPress={agree} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  point: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  links: { gap: spacing.sm },
  box: {
    width: 22,
    height: 22,
    borderRadius: radius.sm / 2,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
});
