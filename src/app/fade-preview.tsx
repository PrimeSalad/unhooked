// Demo of the doomscroll fade: a stand-in feed, the check-in notification, then the white wash.
// On Android the guard service does this over the real app (AppGuardService).

import { useEffect, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button, goBack, Text, TopBar } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';

const POSTS = Array.from({ length: 14 }, (_, i) => i);

export default function FadePreviewScreen() {
  const insets = useSafeAreaInsets();
  const [banner] = useState(() => new Animated.Value(0));
  const [wash] = useState(() => new Animated.Value(0));
  const [scrollY] = useState(() => new Animated.Value(0));
  const [done, setDone] = useState(false);

  useEffect(() => {
    const feed = Animated.loop(
      Animated.timing(scrollY, {
        toValue: 1,
        duration: 9000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    feed.start();
    const seq = Animated.sequence([
      Animated.delay(1500),
      Animated.spring(banner, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 6 }),
      Animated.delay(2500),
      Animated.timing(banner, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(wash, {
        toValue: 0.85,
        duration: 9000,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    seq.start(() => setDone(true));
    return () => {
      feed.stop();
      seq.stop();
    };
  }, [banner, scrollY, wash]);

  return (
    <View style={{ flex: 1, backgroundColor: '#121212' }}>
      <ScrollView scrollEnabled={false} style={StyleSheet.absoluteFill}>
        <Animated.View
          style={{
            padding: spacing.lg,
            paddingTop: insets.top + 64,
            gap: spacing.lg,
            transform: [
              { translateY: scrollY.interpolate({ inputRange: [0, 1], outputRange: [0, -900] }) },
            ],
          }}
        >
          {POSTS.map((i) => (
            <View key={i} style={styles.post}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={styles.dot} />
                <View style={[styles.line, { width: 120 }]} />
              </View>
              <View style={[styles.media, { height: 180 + (i % 3) * 40 }]} />
              <View style={[styles.line, { width: '70%' }]} />
            </View>
          ))}
        </Animated.View>
      </ScrollView>

      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF', opacity: wash }]}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.banner,
          {
            top: insets.top + spacing.sm,
            opacity: banner,
            transform: [
              { translateY: banner.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] }) },
            ],
          },
        ]}
      >
        <Avatar label="U" bg={colors.primary} fg={colors.text} size={34} />
        <View style={{ flex: 1 }}>
          <Text variant="strong" style={{ fontSize: 14 }}>
            Still scrolling on purpose?
          </Text>
          <Text variant="caption">TikTok · 15 min. Your screen will slowly fade.</Text>
        </View>
      </Animated.View>

      <View style={{ position: 'absolute', top: insets.top + spacing.sm, left: spacing.lg }}>
        <TopBar icon="close" dark />
      </View>

      {done && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.xl }]}>
          <Text variant="heading" align="center">
            That is the doomscroll fade.
          </Text>
          <Text variant="small" align="center" color={colors.textMuted}>
            On your Android phone it happens over the real app. Touches still work, so you are never
            locked out. Leave the app and it clears.
          </Text>
          <Button label="Got it" kind="ink" onPress={goBack} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  post: { gap: spacing.sm },
  dot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2C2C2C' },
  line: { height: 10, borderRadius: 5, backgroundColor: '#2C2C2C' },
  media: { borderRadius: radius.md, backgroundColor: '#242424' },
  banner: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.xl,
    gap: spacing.md,
  },
});
