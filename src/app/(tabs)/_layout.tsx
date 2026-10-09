import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { colors } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const tab = (title: string, icon: IconName) => ({
  title,
  tabBarIcon: ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={icon} color={color} size={size} />
  ),
});

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={tab('Today', 'leaf-outline')} />
      <Tabs.Screen name="debt" options={tab('Debt', 'wallet-outline')} />
      <Tabs.Screen name="spend" options={tab('Spend', 'cart-outline')} />
      <Tabs.Screen name="scroll" options={tab('Scroll', 'phone-portrait-outline')} />
      <Tabs.Screen name="insights" options={tab('Insights', 'sparkles-outline')} />
    </Tabs>
  );
}
