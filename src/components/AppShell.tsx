import { router, usePathname, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { Ginto } from '@/components/mascot/Ginto';
import { Text } from '@/components/ui';
import { colors, fonts, layout, radius, spacing } from '@/constants/theme';
import { useSettings } from '@/store/settings';

const destinations: { label: string; icon: IconName; href: Href; path: string }[] = [
  { label: 'Today', icon: 'home', href: '/', path: '/' },
  { label: 'Debt & repayments', icon: 'wallet', href: '/debt', path: '/debt' },
  { label: 'Mindful spending', icon: 'bag', href: '/spend', path: '/spend' },
  { label: 'Time & attention', icon: 'leaf', href: '/scroll', path: '/scroll' },
  { label: 'Your patterns', icon: 'chart', href: '/insights', path: '/insights' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const onboarded = useSettings((s) => s.onboarded);
  const immersive = ['/welcome', '/pause', '/break', '/shield', '/unhooked', '/fade-preview'].includes(pathname);
  const showSidebar = width >= layout.desktop && onboarded && !immersive;
  return <View style={styles.shell}>
    {showSidebar && <View style={styles.sidebar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Unhooked home" onPress={() => router.navigate('/')} style={styles.brand}>
        <View style={styles.mark}><Icon name="leaf" size={23} color={colors.bg} /></View>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 24, letterSpacing: -1.2 }}>unhooked</Text>
      </Pressable>
      <ScrollView contentContainerStyle={{ flexGrow: 1, gap: spacing.xl }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 6 }}>
          <Text variant="eyebrow" style={styles.navLabel}>A little more intention</Text>
          {destinations.map((item) => <NavItem key={item.path} {...item} active={pathname === item.path} />)}
        </View>
        <View style={{ gap: 6 }}>
          <Text variant="eyebrow" style={styles.navLabel}>A moment of support</Text>
          <NavItem label="Ask Ginto" icon="chat" href="/chat" active={pathname === '/chat'} />
          <NavItem label="Check a message" icon="shield" href="/message-check" active={pathname === '/message-check'} />
        </View>
        <View style={{ flex: 1 }} />
        <View style={styles.note}>
          <Ginto mood="calm" size={58} />
          <Text variant="strong" style={{ marginTop: 4 }}>Room to choose.</Text>
          <Text variant="small" color={colors.textSoft}>Small pauses. Decisions that feel more like you.</Text>
        </View>
        <View style={{ gap: 12 }}>
          <NavItem label="Your settings" icon="person" href="/settings" active={pathname === '/settings'} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }}>
            <Icon name="lock" color={colors.textMuted} size={13} />
            <Text variant="caption" style={{ fontSize: 11 }}>Private. On this device.</Text>
          </View>
        </View>
      </ScrollView>
    </View>}
    <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
  </View>;
}

function NavItem({ label, icon, href, active }: { label: string; icon: IconName; href: Href; active: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => router.navigate(href)}
    style={({ pressed }) => [styles.nav, active && { backgroundColor: colors.text }, pressed && { opacity: .75 }]}>
    <Icon name={icon} size={19} color={active ? colors.bg : colors.textSoft} />
    <Text variant="small" color={active ? colors.bg : colors.textSoft} style={{ fontFamily: active ? fonts.semibold : fonts.medium }}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: 'row', backgroundColor: colors.bg },
  sidebar: { width: layout.sidebarWidth, padding: 20, borderRightWidth: 1, borderRightColor: colors.border, backgroundColor: colors.shell, gap: 44 },
  brand: { minHeight: 52, flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 10 },
  mark: { width: 37, height: 37, borderRadius: 12, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontSize: 9, letterSpacing: 1.2, paddingHorizontal: 12, marginBottom: 10 },
  nav: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.md, paddingHorizontal: 12 },
  note: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 24, paddingHorizontal: 12, gap: 6 },
});
