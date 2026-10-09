import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { useSession } from '@/store/session';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/** One global toast. Call useSession.getState().showToast('…') from anywhere. */
export function ToastHost() {
  const message = useSession((s) => s.toast);
  const clear = useSession((s) => s.clearToast);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const v = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    if (!message) return;
    v.setValue(0);
    if (reduced) v.setValue(1);
    else Animated.timing(v, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(v, {
        toValue: 0,
        duration: reduced ? 0 : 160,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => clear());
    }, 4500);
    return () => clearTimeout(t);
  }, [clear, message, v, reduced]);

  if (!message) return null;
  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={[
        styles.toast,
        {
          bottom: insets.bottom + (width >= 1000 ? 24 : 96),
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
    alignSelf: 'center',
    width: '90%',
    maxWidth: 520,
    backgroundColor: colors.text,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});
