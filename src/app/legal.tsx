// Full Privacy Policy or Terms of Use, from the agree screen and Settings.

import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { Screen, ScreenHeader, Text } from '@/components/ui';
import { LEGAL_VERSION, PRIVACY_POLICY, TERMS_OF_USE } from '@/constants/legal';
import { colors, spacing } from '@/constants/theme';

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const terms = doc === 'terms';
  const sections = terms ? TERMS_OF_USE : PRIVACY_POLICY;

  return (
    <Screen tabs={false}>
      <ScreenHeader
        back
        title={terms ? 'Terms of Use' : 'Privacy Policy'}
        subtitle={`Version ${LEGAL_VERSION}`}
      />
      {sections.map((section) => (
        <View key={section.heading} style={{ gap: spacing.xs }}>
          <Text variant="strong">{section.heading}</Text>
          {section.body.map((paragraph) => (
            <Text key={paragraph} variant="small" color={colors.textMuted}>
              {paragraph}
            </Text>
          ))}
        </View>
      ))}
    </Screen>
  );
}
