// Design-system primitives. Screens compose these; extend here, not inline.

import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { router } from 'expo-router';
import { useEffect, useId, type ReactNode, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  useWindowDimensions,
  type TextInputProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ginto, type GintoMood } from '@/components/mascot/Ginto';
import { colors, fonts, layout, motion, radius, spacing } from '@/constants/theme';
import type { Certainty } from '@/domain/types';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export type { IconName } from '@/components/Icon';

/** router.back(), or go Home when there is nothing to go back to. */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

// ---------- Text ----------

const textVariants = StyleSheet.create({
  display: { fontFamily: fonts.medium, fontSize: 46, lineHeight: 54, letterSpacing: -1.8 },
  title: { fontFamily: fonts.medium, fontSize: 28, lineHeight: 37, letterSpacing: -0.9 },
  heading: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 25, letterSpacing: -0.2 },
  number: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.5 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23 },
  strong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 17 },
  eyebrow: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
});

export type TextVariant = keyof typeof textVariants;

const defaultTone: Record<TextVariant, string> = {
  display: colors.text,
  title: colors.text,
  heading: colors.text,
  number: colors.text,
  body: colors.text,
  strong: colors.text,
  small: colors.textSoft,
  caption: colors.textMuted,
  eyebrow: colors.textMuted,
};

export function Text({
  variant = 'body',
  color,
  align,
  style,
  ...rest
}: TextProps & { variant?: TextVariant; color?: string; align?: TextStyle['textAlign'] }) {
  return (
    <RNText
      accessibilityRole={variant === 'title' || variant === 'heading' ? 'header' : undefined}
      style={[
        textVariants[variant],
        { color: color ?? defaultTone[variant] },
        align ? { textAlign: align } : null,
        style,
      ]}
      {...rest}
    />
  );
}

// ---------- Layout ----------

/** Fades + rises children in on mount (450 ms, 14 px). */
export function Rise({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const v = useState(() => new Animated.Value(reduced ? 1 : 0))[0];
  useEffect(() => {
    if (reduced) {
      v.setValue(1);
      return;
    }
    Animated.timing(v, {
      toValue: 1,
      duration: motion.rise,
      delay,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [delay, reduced, v]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function Screen({
  children,
  bg = colors.bg,
  tabs = true,
  gap = spacing.xl,
}: {
  children: ReactNode;
  bg?: string;
  /** Inside the tab navigator (the tab bar handles the bottom inset). */
  tabs?: boolean;
  gap?: number;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const desktop = width >= layout.desktop;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{
        paddingTop: insets.top + (desktop ? spacing.xxxl : spacing.xl),
        paddingHorizontal: desktop ? spacing.xxxl : spacing.xl,
        paddingBottom: (tabs && !desktop ? layout.tabBarSpace : insets.bottom) + spacing.xxxl,
        gap,
        width: '100%',
        maxWidth: tabs ? layout.contentWidth : 800,
        alignSelf: 'center',
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  mascot,
  back,
}: {
  title: string;
  subtitle?: string;
  mascot?: GintoMood;
  back?: boolean;
}) {
  return (
    <View style={{ gap: spacing.md }}>
      {back && <IconButton icon="back" label="Back" onPress={goBack} />}
      <View
        style={{ flexDirection: 'row', alignItems: 'center', minHeight: mascot ? 82 : undefined }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title">{title}</Text>
          {subtitle ? (
            <Text variant="small" color={colors.textMuted}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {mascot ? <Ginto mood={mascot} size={92} /> : null}
      </View>
    </View>
  );
}

// ---------- Surfaces ----------

export function Card({
  children,
  style,
  tone = colors.surface,
  flat,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: string;
  flat?: boolean;
}) {
  return (
    <View style={[styles.card, { backgroundColor: tone }, flat ? null : { borderWidth: 1, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
}

export function Row({
  children,
  style,
  gap = spacing.md,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>
  );
}

export function IconChip({
  icon,
  bg,
  fg,
  size = 42,
}: {
  icon: IconName;
  bg: string;
  fg: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.34,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={size * 0.52} color={fg} />
    </View>
  );
}

export function ListRow({
  icon,
  iconBg,
  iconFg,
  title,
  subtitle,
  onPress,
  trailing,
}: {
  icon: IconName;
  iconBg: string;
  iconFg: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}
    >
      <IconChip icon={icon} bg={iconBg} fg={iconFg} />
      <View style={{ flex: 1 }}>
        <Text variant="strong">{title}</Text>
        {subtitle ? <Text variant="caption">{subtitle}</Text> : null}
      </View>
      {trailing ?? <Icon name="forward" size={20} color={colors.textFaint} />}
    </Pressable>
  );
}

export function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={{ flex: 1, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: 4 }}>
      <Text variant="number">{value}</Text>
      <Text variant="caption">{label}</Text>
    </View>
  );
}

export function ProgressBar({
  value,
  color = colors.primary,
  track = colors.track,
  height = 8,
}: {
  value: number;
  color?: string;
  track?: string;
  height?: number;
}) {
  const pctValue = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pctValue) }} style={{ height, borderRadius: radius.pill, backgroundColor: track, overflow: 'hidden' }}>
      <View
        style={{
          width: `${pctValue}%`,
          height: '100%',
          borderRadius: radius.pill,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text variant="strong" style={{ fontSize: 14 }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- Buttons ----------

type ButtonKind = 'primary' | 'ink' | 'outline' | 'ghost' | 'outlineLight' | 'ghostLight';

const buttonKinds: Record<ButtonKind, { box: ViewStyle; text: string }> = {
  primary: { box: { backgroundColor: colors.primary }, text: colors.primaryText },
  ink: { box: { backgroundColor: colors.text }, text: colors.bg },
  outline: { box: { borderWidth: 1, borderColor: colors.border }, text: colors.text },
  ghost: { box: {}, text: colors.textSoft },
  outlineLight: {
    box: { borderWidth: 2, borderColor: 'rgba(255,246,236,0.55)' },
    text: colors.pauseText,
  },
  ghostLight: { box: {}, text: '#FFE9D2' },
};

export function Button({
  label,
  onPress,
  kind = 'primary',
  size = 'md',
  icon,
  disabled,
  loading = false,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  size?: 'md' | 'sm';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const k = buttonKinds[kind];
  const inactive = disabled || loading;
  if (Platform.OS === 'web') {
    const variant = { primary: 'btn-primary', ink: 'btn-neutral', outline: 'btn-outline', ghost: 'btn-ghost', outlineLight: 'btn-outline', ghostLight: 'btn-ghost' }[kind];
    return <View style={style}>
      <button type="button" className={`btn ${variant}`} disabled={inactive} aria-busy={loading} onClick={onPress}
        style={{ minHeight: size === 'md' ? 52 : 44, color: k.text, borderColor: kind === 'outlineLight' ? colors.pauseMuted : undefined }}>
        {loading ? <span className="loading loading-spinner loading-sm" aria-hidden="true" /> : icon ? <Icon name={icon} size={18} color={k.text} /> : null}
        <span>{label}</span>
      </button>
    </View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        { minHeight: size === 'md' ? 54 : 44 },
        k.box,
        pressed && !disabled && styles.pressed,
        inactive && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={k.text} /> : icon ? <Icon name={icon} size={18} color={k.text} /> : null}
      <Text variant="strong" color={k.text} style={{ fontSize: size === 'md' ? 16 : 14 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  tone = colors.surface,
  color = colors.text,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: string;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: tone },
        pressed && styles.pressed,
      ]}
    >
      <Icon name={icon} size={22} color={color} />
    </Pressable>
  );
}

// ---------- Tags ----------

const tagTones = {
  records: { bg: colors.surfaceMuted, fg: colors.textSoft, label: 'From your records' },
  estimate: { bg: colors.surfaceMuted, fg: colors.textSoft, label: 'Estimate' },
  calculated: { bg: colors.surfaceMuted, fg: colors.textSoft, label: 'Calculated' },
  suggestion: { bg: colors.surfaceMuted, fg: colors.textSoft, label: 'Suggestion' },
} as const;

const certaintyTone: Record<Certainty, keyof typeof tagTones> = {
  fact: 'records',
  estimate: 'estimate',
  suggestion: 'suggestion',
};

/** Responsible-AI requirement (plan.md R3): every generated line shows fact / estimate / suggestion. */
export function Tag({
  tone,
  certainty,
  label,
  dark,
}: {
  tone?: keyof typeof tagTones;
  certainty?: Certainty;
  label?: string;
  dark?: boolean;
}) {
  const t = tagTones[tone ?? (certainty ? certaintyTone[certainty] : 'suggestion')];
  return (
    <View style={[styles.tag, { backgroundColor: dark ? 'rgba(255,246,236,0.12)' : t.bg }]}>
      <Text
        variant="eyebrow"
        color={dark ? '#FFD9B5' : t.fg}
        style={{ fontSize: 10.5, letterSpacing: 0.4 }}
      >
        {label ?? t.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pressed: { opacity: 0.72 },
  button: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  segmented: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  segment: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: colors.surface },
});

// ---------- Forms ----------

export function Field({
  label,
  hint,
  error,
  style,
  onFocus,
  onBlur,
  ...input
}: TextInputProps & { label: string; hint?: string; error?: string }) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {Platform.OS === 'web' ? <label htmlFor={id} style={{ fontFamily: fonts.semibold, color: colors.textSoft, fontSize: 13 }}>{label}</label> : <Text variant="caption" color={colors.textSoft} style={{ fontFamily: fonts.semibold }}>
        {label}
      </Text>}
      <TextInput
        nativeID={id}
        placeholderTextColor={colors.textFaint}
        style={[formStyles.input, focused && { borderColor: colors.lagoon }, error ? { borderColor: colors.danger } : null, style]}
        accessibilityLabel={label}
        accessibilityHint={error || hint}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${id}-help` : undefined}
        onFocus={(event) => { setFocused(true); onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); onBlur?.(event); }}
        {...input}
      />
      {error ? <Text nativeID={`${id}-help`} accessibilityRole="alert" variant="caption" color={colors.danger}>{error}</Text> : hint ? <Text nativeID={`${id}-help`} variant="caption">{hint}</Text> : null}
    </View>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[formStyles.chip, active && formStyles.chipActive]}
          >
            <Text
              variant="strong"
              color={active ? colors.bg : colors.textSoft}
              style={{ fontSize: 13 }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Friendly empty state: Ginto + one sentence + one action. */
export function EmptyState({
  mood = 'happy',
  title,
  body,
  action,
  onAction,
}: {
  mood?: GintoMood;
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl, gap: spacing.sm, backgroundColor: colors.surfaceMuted, borderRadius: radius.lg }}>
      <Ginto mood={mood} size={76} />
      <Text variant="heading" align="center">
        {title}
      </Text>
      <Text variant="small" align="center" color={colors.textMuted}>
        {body}
      </Text>
      {action && onAction ? (
        <Button
          label={action}
          size="sm"
          onPress={onAction}
          style={{ marginTop: spacing.sm, alignSelf: 'stretch' }}
        />
      ) : null}
    </View>
  );
}

/** Bottom sheet with an optional Ginto peeking over the top edge. */
export function Sheet({
  open,
  onClose,
  mascot,
  children,
}: {
  open: boolean;
  onClose: () => void;
  mascot?: GintoMood;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  return (
    <Modal
      visible={open}
      transparent
      animationType={reduced ? 'none' : 'fade'}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <Pressable style={formStyles.scrim} onPress={onClose} accessible={false} />
        <View
          accessibilityViewIsModal
          style={[
            formStyles.sheet,
            {
              paddingTop: spacing.lg,
              paddingBottom: insets.bottom + spacing.xl,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            {mascot ? <Ginto mood={mascot} size={60} /> : <View />}
            <IconButton icon="close" label="Close dialog" onPress={onClose} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.sm }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const formStyles = StyleSheet.create({
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.text,
  },
  chip: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(42,22,8,0.4)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  sheetFish: { position: 'absolute', top: -60, alignSelf: 'center' },
});

/** Back (or close) button row for every non-tab screen. */
export function TopBar({
  icon = 'back',
  onPress = goBack,
  dark,
  right,
}: {
  icon?: 'back' | 'close';
  onPress?: () => void;
  dark?: boolean;
  right?: ReactNode;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <IconButton
        icon={icon}
        label={icon === 'close' ? 'Close' : 'Back'}
        onPress={onPress}
        tone={dark ? 'rgba(255,246,236,0.12)' : colors.surface}
        color={dark ? colors.bg : colors.text}
      />
      {right}
    </View>
  );
}

// ---------- Real-app hierarchy: large titles, sections, grouped lists ----------

/** Large title like native apps. No mascot: Ginto appears in moments, not chrome. */
export function LargeTitle({
  eyebrow,
  title,
  right,
}: {
  eyebrow?: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, marginBottom: 2 }}
    >
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text variant="caption">{eyebrow}</Text> : null}
        <Text variant="title" style={{ fontSize: 32, lineHeight: 42, letterSpacing: -1.2 }}>
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

export function Section({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: spacing.md,
          flexWrap: 'wrap',
        }}
      >
        <Text variant="heading" style={{ fontSize: 17 }}>
          {title}
        </Text>
        {action && onAction ? (
          <Pressable accessibilityRole="button" onPress={onAction} hitSlop={6} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text variant="strong" color={colors.link} style={{ fontSize: 12 }}>
              {action}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Grouped list: one surface, hairline dividers, rows inside. */
export function Group({ children }: { children: ReactNode }) {
  const items = (Array.isArray(children) ? children : [children]).flat().filter(Boolean);
  return (
    <View
      style={[
        { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, overflow: 'hidden' },
      ]}
    >
      {items.map((child, i) => (
        <View key={i}>
          {i > 0 ? (
            <View style={{ height: 1, backgroundColor: colors.border }} />
          ) : null}
          {child}
        </View>
      ))}
    </View>
  );
}

export function GroupRow({
  icon,
  iconBg = colors.surfaceMuted,
  iconFg = colors.text,
  leading,
  title,
  subtitle,
  value,
  valueTone,
  onPress,
  trailing,
}: {
  icon?: IconName;
  iconBg?: string;
  iconFg?: string;
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  value?: string;
  valueTone?: string;
  onPress?: () => void;
  trailing?: ReactNode;
}) {
  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: 14,
        paddingHorizontal: spacing.xs,
        minHeight: 64,
      }}
    >
      {leading ?? (icon ? <IconChip icon={icon} bg={iconBg} fg={iconFg} size={38} /> : null)}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="strong" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="strong" color={valueTone ?? colors.text}>
          {value}
        </Text>
      ) : null}
      {trailing ?? (onPress ? <Icon name="forward" size={18} color={colors.textFaint} /> : null)}
    </View>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => pressed && { backgroundColor: colors.surfaceMuted }}
    >
      {body}
    </Pressable>
  ) : (
    body
  );
}

/** Letter avatar for people, lenders and apps without an icon. */
export function Avatar({
  label,
  bg = colors.surfaceMuted,
  fg = colors.text,
  size = 38,
}: {
  label: string;
  bg?: string;
  fg?: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="strong" color={fg} style={{ fontSize: size * 0.4 }}>
        {label.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}
