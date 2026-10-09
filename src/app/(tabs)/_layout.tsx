import { Tabs } from 'expo-router';

import { FloatingTabBar } from '@/components/FloatingTabBar';
import { colors } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="debt" options={{ title: 'Debt' }} />
      <Tabs.Screen name="spend" options={{ title: 'Spend' }} />
      <Tabs.Screen name="scroll" options={{ title: 'Scroll' }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights', href: null }} />
    </Tabs>
  );
}
