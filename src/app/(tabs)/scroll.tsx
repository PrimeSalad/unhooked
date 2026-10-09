import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ginto } from '@/components/mascot/Ginto';
import { Button, Card, ProgressBar, Rise, Row, Screen, ScreenHeader, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { demoScroll as s } from '@/demo/ana';
import { useSession } from '@/store/session';

function CheckInSheet({ open, onClose }: { open: boolean; onClose: (msg?: string) => void }) {
  const insets = useSafeAreaInsets();
  const slide = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    if (!open) return;
    slide.setValue(0);
    Animated.timing(slide, {
      toValue: 1,
      duration: 550,
      easing: Easing.bezier(0.2, 0.9, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [open, slide]);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => onClose()}>
      <Pressable style={styles.scrim} onPress={() => onClose()} accessibilityLabel="Close" />
      <Animated.View
        style={[
          styles.sheet,
          {
            paddingBottom: insets.bottom + spacing.xl,
            transform: [
              { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }) },
            ],
          },
        ]}
      >
        <Ginto mood="sleepy" size={128} style={styles.peek} />
        <Text variant="heading" align="center" style={{ fontSize: 21, lineHeight: 27 }}>
          You have been scrolling for {s.minutes} minutes.
        </Text>
        <Text variant="small" align="center" style={{ marginBottom: spacing.sm }}>
          Still using this time the way you meant to?
        </Text>
        <Button
          label="Take a break"
          onPress={() => {
            onClose();
            router.push('/break');
          }}
        />
        <Button
          label="I am using this on purpose"
          kind="outline"
          onPress={() => onClose('Got it. Enjoy it on purpose.')}
        />
        <Button
          label="Remind me in 10 minutes"
          kind="ghost"
          size="sm"
          onPress={() => onClose('I will check in again in 10 minutes.')}
        />
      </Animated.View>
    </Modal>
  );
}

export default function ScrollScreen() {
  const [open, setOpen] = useState(false);
  const breaks = useSession((st) => st.breaks);
  const showToast = useSession((st) => st.showToast);

  return (
    <Screen>
      <ScreenHeader title="Scroll" subtitle="Use your feed on purpose." mascot="happy" />

      <Rise>
        <View style={styles.session}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="eyebrow" color={colors.pauseMuted} style={{ fontSize: 11 }}>
              {s.app} · session running
            </Text>
            <View style={styles.liveDot} />
          </Row>
          <Text variant="display" color="#F2FBFC">
            {s.elapsed}
          </Text>
          <ProgressBar value={1} color={colors.accent} track="rgba(242,251,252,0.18)" />
          <Text variant="caption" color="#BFE6EC">
            Your limit: {s.limit} minutes
          </Text>
        </View>
      </Rise>

      <Rise delay={60}>
        <Card style={{ gap: spacing.md }}>
          <Text variant="strong">This week</Text>
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <Text variant="heading" style={{ fontSize: 20 }}>
                {s.weekTotal}
              </Text>
              <Text variant="caption">Total</Text>
            </View>
            <View>
              <Text variant="heading" style={{ fontSize: 20 }}>
                {s.peak}
              </Text>
              <Text variant="caption">Peak time</Text>
            </View>
            <View>
              <Text variant="heading" style={{ fontSize: 20 }}>
                {breaks}
              </Text>
              <Text variant="caption">Breaks</Text>
            </View>
          </Row>
        </Card>
      </Rise>

      <Rise delay={120}>
        <Button label="Show the check-in" onPress={() => setOpen(true)} />
      </Rise>

      <CheckInSheet
        open={open}
        onClose={(msg) => {
          setOpen(false);
          if (msg) showToast(msg);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  session: {
    backgroundColor: colors.lagoonDeep,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(42,22,8,0.35)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingTop: 92,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  peek: { position: 'absolute', top: -64, alignSelf: 'center' },
});
