// Web only: keeps the mobile layout at phone width in a desktop browser instead of
// stretching it across the window. On native it renders children as-is.

import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';
import { PHONE_MAX_WIDTH } from '@/hooks/useFrame';

export function PhoneFrame({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={styles.outer}>
      <View style={styles.frame}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, alignItems: 'center', backgroundColor: colors.surfaceMuted },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: PHONE_MAX_WIDTH,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
});
