import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/poppins';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';

import { PhoneFrame } from '@/components/PhoneFrame';
import { ToastHost } from '@/components/Toast';
import { colors } from '@/constants/theme';
import { DatabaseGate } from '@/db/DatabaseGate';
import { useWarmLocalModel } from '@/hooks/useWarmLocalModel';

export default function RootLayout() {
  useWarmLocalModel();
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  // Fall back to system fonts rather than blocking the app if a font fails to load.
  if (!fontsLoaded && !fontError) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bg,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <PhoneFrame>
      <DatabaseGate>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            // iOS-style push with parallax on both platforms; swipe back follows the finger.
            animation: 'ios_from_right',
            animationMatchesGesture: true,
            fullScreenGestureEnabled: true,
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
          <Stack.Screen
            name="pause"
            options={{ presentation: 'fullScreenModal', animation: 'fade' }}
          />
          <Stack.Screen name="unhooked" options={{ animation: 'fade' }} />
          <Stack.Screen name="break" options={{ animation: 'fade' }} />
          <Stack.Screen
            name="check-in"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="debt-new"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="repayment-plan" />
          <Stack.Screen name="evidence-pack" />
          <Stack.Screen
            name="borrow"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="chat" />
          <Stack.Screen name="spend-check" />
          <Stack.Screen name="fade-preview" options={{ animation: 'fade' }} />
          <Stack.Screen name="block/apps" />
          <Stack.Screen name="block/sites" />
          <Stack.Screen name="block/permissions" />
          <Stack.Screen
            name="shield"
            options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }}
          />
          <Stack.Screen name="message-check" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="wrapped" />
          <Stack.Screen name="scan" />
        </Stack>
        <ToastHost />
      </DatabaseGate>
    </PhoneFrame>
  );
}
