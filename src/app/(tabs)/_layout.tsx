import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { Platform, type ColorValue } from 'react-native';

import type { IconName } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';

const tab = (title: string, icon: IconName, activeIcon: IconName) => ({
  title,
  tabBarIcon: ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? activeIcon : icon} color={color} size={24} />
  ),
});

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.link,
        tabBarInactiveTintColor: '#8A6E5C',
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          // Web has no safe-area inset, so give the labels room explicitly.
          ...(Platform.OS === 'web' ? { height: 64, paddingBottom: 8 } : null),
        },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={tab('Today', 'home-outline', 'home')} />
      <Tabs.Screen name="debt" options={tab('Debt', 'wallet-outline', 'wallet')} />
      <Tabs.Screen name="spend" options={tab('Spend', 'bag-handle-outline', 'bag-handle')} />
      <Tabs.Screen
        name="scroll"
        options={tab('Scroll', 'phone-portrait-outline', 'phone-portrait')}
      />
      <Tabs.Screen name="insights" options={tab('Insights', 'bar-chart-outline', 'bar-chart')} />
    </Tabs>
  );
}
