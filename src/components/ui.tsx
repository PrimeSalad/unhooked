// Minimal design-system primitives. Screens compose these; extend here, not inline.

import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, font, radius, spacing } from '@/constants/theme';
import type { Certainty } from '@/domain/types';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const body = <View style={styles.screenBody}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      {scroll ? <ScrollView contentContainerStyle={styles.scroll}>{body}</ScrollView> : body}
    </SafeAreaView>
  );
}

type Variant = 'title' | 'heading' | 'body' | 'muted' | 'caption';

export function Text({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  return <RNText style={[textStyles[variant], style]} {...rest} />;
}

export function Card({
  children,
  accent,
  style,
}: {
  children: ReactNode;
  accent?: string;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[styles.card, accent ? { borderLeftWidth: 4, borderLeftColor: accent } : null, style]}
    >
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        buttonStyles[kind],
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      <RNText style={[styles.buttonLabel, kind !== 'primary' && { color: colors.text }]}>
        {label}
      </RNText>
    </Pressable>
  );
}

const certaintyLabel: Record<Certainty, string> = {
  fact: 'From your records',
  estimate: 'Estimate',
  suggestion: 'Suggestion',
};

/** Responsible-AI requirement: every generated line shows whether it is a fact, estimate or suggestion. */
export function CertaintyTag({ certainty }: { certainty: Certainty }) {
  return (
    <View style={styles.tag}>
      <RNText style={styles.tagText}>{certaintyLabel[certainty]}</RNText>
    </View>
  );
}

export function Placeholder({ phase, children }: { phase: string; children: ReactNode }) {
  return (
    <Card style={{ borderStyle: 'dashed' }}>
      <Text variant="caption">{`Coming in ${phase} — see plan.md`}</Text>
      <Text variant="muted">{children}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: spacing.xxl },
  screenBody: { padding: spacing.lg, gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  button: {
    minHeight: 48,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    color: colors.primaryText,
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
  },
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  tagText: { fontSize: font.size.xs, color: colors.textMuted },
});

const buttonStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: 'transparent', borderWidth: 2, borderColor: colors.text },
  ghost: { backgroundColor: 'transparent' },
});

const textStyles = StyleSheet.create({
  title: { fontSize: font.size.xxl, fontWeight: font.weight.bold, color: colors.text },
  heading: { fontSize: font.size.lg, fontWeight: font.weight.semibold, color: colors.text },
  body: { fontSize: font.size.md, color: colors.text, lineHeight: 22 },
  muted: { fontSize: font.size.sm, color: colors.textMuted, lineHeight: 20 },
  caption: {
    fontSize: font.size.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
