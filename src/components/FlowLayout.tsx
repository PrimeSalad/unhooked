import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Button, Screen, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';

/** Reading and data-entry flows stay comfortably narrow at every screen size. */
export function FlowScreen({ children, bg }: { children: ReactNode; bg?: string }) {
  return (
    <Screen tabs={false} bg={bg}>
      <View style={styles.flow}>{children}</View>
    </Screen>
  );
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="heading">{title}</Text>
        {description ? <Text variant="small">{description}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export function ActionError({ message, onRetry }: { message?: string | null; onRetry?: () => void }) {
  if (!message) return null;
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
        <Icon name="alert" size={20} color={colors.danger} />
        <Text variant="small" color={colors.danger} style={{ flex: 1 }}>{message}</Text>
      </View>
      {onRetry ? <Button label="Try again" kind="outline" size="sm" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flow: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: spacing.xxl },
  section: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.xl, gap: spacing.lg },
  error: { borderLeftWidth: 3, borderLeftColor: colors.danger, backgroundColor: colors.surface, padding: spacing.lg, gap: spacing.md },
});
