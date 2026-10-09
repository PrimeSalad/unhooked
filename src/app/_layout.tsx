import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Component, Suspense, type ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

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

/** Shows the real error instead of an endless spinner if the database fails to open. */
class DatabaseErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.bg }}>
        <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 8 }}>
          Unhooked could not open its local database.
        </Text>
        <Text style={{ fontSize: 14, color: colors.textMuted }}>{this.state.error.message}</Text>
      </View>
    );
  }
}

export default function RootLayout() {
  return (
    <DatabaseErrorBoundary>
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
    </DatabaseErrorBoundary>
  );
}
