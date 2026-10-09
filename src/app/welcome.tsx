import { router } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DotPattern } from '@/components/DotPattern';
import { Ginto } from '@/components/mascot/Ginto';
import { Hook } from '@/components/mascot/Hook';
import { Button, Rise, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { useSettings } from '@/store/settings';

export default function WelcomeScreen() {
  const setOnboarded = useSettings((s) => s.setOnboarded);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <DotPattern />
      <Hook x={width - 92} y={insets.top + 150} shown lineColor="#FFE1B8" />

      <Rise style={{ gap: 10 }}>
        <Text variant="eyebrow" color="#FFE9D2">
          Hi, I am Ginto
        </Text>
        <Text variant="display" style={{ fontSize: 54, lineHeight: 58 }}>
          unhooked
        </Text>
        <Text variant="heading" color="#3B1E08" style={{ fontSize: 17 }}>
          Pause. Understand. Decide.
        </Text>
      </Rise>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Ginto mood="wave" size={Math.min(250, width * 0.64)} />
      </View>

      <Rise delay={150} style={{ gap: spacing.lg }}>
        <Text color={colors.text}>
          When a loan, a checkout or an endless feed starts pulling, I swim in for a short pause.
          You always make the call.
        </Text>
        <Button
          label="Let's swim"
          kind="ink"
          onPress={() => {
            setOnboarded(true);
            router.replace('/');
          }}
        />
        <Text variant="caption" color="#3B1E08" align="center">
          Everything stays on your phone.
        </Text>
      </Rise>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    overflow: 'hidden',
  },
});
