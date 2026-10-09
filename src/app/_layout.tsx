import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { colors } from '@/constants/theme';
import { DATABASE_NAME, migrateDbIfNeeded } from '@/db/migrations';

function Loading() {
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

export default function RootLayout() {
  return (
    <Suspense fallback={<Loading />}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded} useSuspense>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="pause"
            options={{ presentation: 'fullScreenModal', headerShown: false }}
          />
          <Stack.Screen name="check-in" options={{ presentation: 'modal', title: 'Check-in' }} />
          <Stack.Screen name="message-check" options={{ title: 'Check a message' }} />
          <Stack.Screen name="help" options={{ title: 'Help & Safety' }} />
          <Stack.Screen name="settings" options={{ title: 'Privacy & Settings' }} />
        </Stack>
      </SQLiteProvider>
    </Suspense>
  );
}
