import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { useSession } from '@/store/session';

/** One global toast. Call useSession.getState().showToast('…') from anywhere. */
export function ToastHost() {
  const message = useSession((s) => s.toast);
  const clear = useSession((s) => s.clearToast);
  const insets = useSafeAreaInsets();
  const v = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    if (!message) return;
    v.setValue(0);
    Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 8 }).start();
    const t = setTimeout(() => {
      Animated.timing(v, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => clear());
    }, 2800);
    return () => clearTimeout(t);
  }, [clear, message, v]);

  if (!message) return null;
  return (
    <Animated.View
      accessibilityRole="alert"
      pointerEvents="none"
      style={[
        styles.toast,
        {
          bottom: insets.bottom + 96,
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        },
      ]}
    >
      <Text variant="small" color={colors.bg}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    backgroundColor: colors.text,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});
