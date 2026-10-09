// Floating pill tab bar with a raised center action (the pause), after the Iconly
// "media-centered navigation" pattern. Hidden routes (href: null) are skipped.

import { Icon } from '@/components/Icon';
import { router, type Tabs } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Animated, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ginto } from '@/components/mascot/Ginto';
import { Text, type IconName } from '@/components/ui';
import { colors, fonts, layout, radius, shadow, spacing } from '@/constants/theme';
import { useSession } from '@/store/session';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const ICONS: Record<string, [IconName, IconName]> = {
  index: ['home', 'home'],
  debt: ['wallet', 'wallet'],
  spend: ['bag', 'bag'],
  scroll: ['device', 'device'],
};

function Tab({
  label,
  focused,
  icon,
  onPress,
}: {
  label: string;
  focused: boolean;
  icon: [IconName, IconName];
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.tab, pressed && { opacity: 0.6 }]}
    >
      <Icon
        name={focused ? icon[1] : icon[0]}
        size={24}
        color={focused ? colors.text : '#A08B7C'}
      />
      <Text
        variant="caption"
        color={focused ? colors.text : '#A08B7C'}
        style={{ fontFamily: focused ? fonts.semibold : fonts.medium, fontSize: 11 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function FloatingTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const setQuickPause = useSession((s) => s.setQuickPause);
  const { width } = useWindowDimensions();
  const visible = state.routes.filter((r) => ICONS[r.name]);
  const half = Math.ceil(visible.length / 2);

  // Desktop web uses the AppShell sidebar instead.
  if (width >= layout.desktop) return null;

  const renderTab = (route: (typeof state.routes)[number]) => {
    const index = state.routes.indexOf(route);
    const focused = state.index === index;
    const opts = descriptors[route.key]?.options;
    const label = typeof opts?.title === 'string' ? opts.title : route.name;
    const icon = ICONS[route.name] ?? (['circle', 'circle'] as [IconName, IconName]);
    return (
      <Tab
        key={route.key}
        label={label}
        focused={focused}
        icon={icon}
        onPress={() => {
          const e = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !e.defaultPrevented) navigation.navigate(route.name, route.params);
        }}
      />
    );
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.bar}>
        {visible.slice(0, half).map(renderTab)}
        <View style={styles.centerSlot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pause. Something is pulling at me"
            onPress={() => setQuickPause(true)}
            style={({ pressed }) => [styles.center, pressed && { transform: [{ scale: 0.94 }] }]}
          >
            <View style={styles.pauseBars}>
              <View style={styles.pauseBar} />
              <View style={styles.pauseBar} />
            </View>
          </Pressable>
        </View>
        {visible.slice(half).map(renderTab)}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Chat with Ginto"
        accessibilityHint="Opens a conversation with your money assistant."
        onPress={() => router.push('/chat')}
        style={({ pressed }) => [styles.chatButton, pressed && { opacity: 0.82 }]}
      >
        <Icon name="chat" size={24} color={colors.text} />
      </Pressable>
      <QuickPauseSheet />
    </View>
  );
}

const OPTIONS: {
  icon: IconName;
  title: string;
  sub: string;
  bg: string;
  fg: string;
  go: () => void;
}[] = [
  {
    icon: 'bag',
    title: 'I am about to buy something',
    sub: 'Check it against your budget first',
    bg: colors.spendSoft,
    fg: colors.spend,
    go: () => router.push('/spend'),
  },
  {
    icon: 'wallet',
    title: 'I want to borrow money',
    sub: 'See what you already owe before you sign',
    bg: colors.debtSoft,
    fg: colors.debt,
    go: () => router.push('/borrow'),
  },
  {
    icon: 'device',
    title: 'I keep scrolling',
    sub: 'Set a limit and I will check in',
    bg: colors.scrollSoft,
    fg: colors.scroll,
    go: () => router.push('/scroll'),
  },
  {
    icon: 'chat',
    title: 'I just need to talk',
    sub: 'Ask Ginto anything about your money or habits',
    bg: '#F3ECE4',
    fg: colors.text,
    go: () => router.push('/chat'),
  },
];

function QuickPauseSheet() {
  const open = useSession((s) => s.quickPauseOpen);
  const setOpen = useSession((s) => s.setQuickPause);
  const insets = useSafeAreaInsets();
  const [slide] = useState(() => new Animated.Value(0));

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onShow={() => {
        slide.setValue(0);
        Animated.spring(slide, {
          toValue: 1,
          useNativeDriver: true,
          speed: 16,
          bounciness: 6,
        }).start();
      }}
      onRequestClose={() => setOpen(false)}
    >
      <Pressable style={styles.scrim} onPress={() => setOpen(false)} accessibilityLabel="Close" />
      <Animated.View
        style={[
          styles.sheet,
          {
            paddingBottom: insets.bottom + spacing.xl,
            transform: [
              { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [480, 0] }) },
            ],
          },
        ]}
      >
        <Ginto mood="curious" size={112} style={styles.sheetFish} />
        <Text variant="heading" align="center" style={{ fontSize: 22, lineHeight: 28 }}>
          What is pulling at you?
        </Text>
        <Text
          variant="small"
          align="center"
          color={colors.textMuted}
          style={{ marginBottom: spacing.sm }}
        >
          Pick one. We will take a short pause together.
        </Text>
        {OPTIONS.map((o) => (
          <Pressable
            key={o.title}
            accessibilityRole="button"
            onPress={() => {
              setOpen(false);
              o.go();
            }}
            style={({ pressed }) => [
              styles.option,
              pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
            ]}
          >
            <View style={[styles.optionIcon, { backgroundColor: o.bg }]}>
              <Icon name={o.icon} size={22} color={o.fg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="strong">{o.title}</Text>
              <Text variant="caption">{o.sub}</Text>
            </View>
            <Icon name="forward" size={18} color={colors.textFaint} />
          </Pressable>
        ))}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'stretch' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 74,
    paddingHorizontal: spacing.sm,
    borderRadius: 37,
    backgroundColor: colors.surface,
    shadowColor: '#2A1608',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, height: '100%' },
  centerSlot: { width: 76, alignItems: 'center', justifyContent: 'center' },
  chatButton: {
    position: 'absolute',
    right: 0,
    bottom: 90,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
    elevation: 8,
  },
  center: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2A1608',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  pauseBars: { flexDirection: 'row', gap: 6 },
  pauseBar: { width: 6, height: 20, borderRadius: 3, backgroundColor: colors.primary },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(42,22,8,0.4)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingTop: 72,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  sheetFish: { position: 'absolute', top: -52, alignSelf: 'center' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
