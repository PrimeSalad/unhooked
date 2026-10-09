// Mobile tab navigation. Desktop destinations live in AppShell.
import { Icon } from '@/components/Icon';
import { router, type Tabs } from 'expo-router';
import { type ComponentProps } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, type IconName } from '@/components/ui';
import { colors, fonts, layout } from '@/constants/theme';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];
const icons: Record<string, IconName> = { index: 'home', debt: 'wallet', spend: 'bag', scroll: 'leaf' };

export function FloatingTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  if (width >= layout.desktop) return null;
  return <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
    <View style={styles.bar} accessibilityRole="tablist">
      {state.routes.filter(route => icons[route.name]).map(route => {
        const focused = state.index === state.routes.indexOf(route);
        const label = descriptors[route.key]?.options.title ?? route.name;
        return <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: focused }}
          onPress={() => { const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true }); if (!event.defaultPrevented) navigation.navigate(route.name, route.params); }}
          style={({ pressed }) => [styles.tab, pressed && { opacity: .65 }]}>
          <View style={[styles.icon, focused && { backgroundColor: colors.surfaceMuted }]}><Icon name={icons[route.name]!} size={22} color={focused ? colors.text : colors.textMuted} /></View>
          <Text variant="caption" color={focused ? colors.text : colors.textMuted} style={{ fontSize: 10, fontFamily: focused ? fonts.semibold : fonts.regular }}>{label}</Text>
        </Pressable>;
      })}
      <Pressable accessibilityRole="button" accessibilityLabel="Ask Ginto" onPress={() => router.push('/chat')} style={({ pressed }) => [styles.tab, pressed && { opacity: .65 }]}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}><Icon name="chat" size={22} color={colors.text} /></View>
        <Text variant="caption" color={colors.text} style={{ fontSize: 10 }}>Ginto</Text>
      </Pressable>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  wrap: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  bar: { flexDirection: 'row', width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 8 },
  tab: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 4 },
  icon: { width: 46, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
