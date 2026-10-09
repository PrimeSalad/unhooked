// Opens the local database for the whole app. Native lock errors are retried;
// web uses SQLiteProvider's shared Suspense initialization promise to avoid overlapping opens.

import { SQLiteProvider } from 'expo-sqlite';
import { Component, Suspense, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

import { DATABASE_NAME, migrateDbIfNeeded } from './migrations';

const MAX_RETRIES = 8;
const RETRY_MS = 400;

const isLockError = (e: Error) =>
  /Access Handle|NoModificationAllowed|Invalid VFS state|database is locked/i.test(e.message);

type WebDatabaseBoundaryProps = { children: ReactNode };
type WebDatabaseBoundaryState = { error: Error | null };

class WebDatabaseBoundary extends Component<WebDatabaseBoundaryProps, WebDatabaseBoundaryState> {
  state: WebDatabaseBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): WebDatabaseBoundaryState {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.bg }}>
        <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 8 }}>
          Unhooked could not open its local database.
        </Text>
        <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 20 }}>
          {error.message}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => window.location.reload()}
          style={{
            minHeight: 48,
            alignSelf: 'flex-start',
            justifyContent: 'center',
            paddingHorizontal: 20,
            borderRadius: 24,
            backgroundColor: colors.text,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.bg }}>Reload app</Text>
        </Pressable>
      </View>
    );
  }
}

function WebDatabaseGate({ children }: { children: ReactNode }) {
  return (
    <WebDatabaseBoundary>
      <Suspense
        fallback={
          <View
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}
          >
            <ActivityIndicator color={colors.primary} />
          </View>
        }
      >
        <SQLiteProvider
          databaseName={DATABASE_NAME}
          onInit={migrateDbIfNeeded}
          useSuspense
        >
          {children}
        </SQLiteProvider>
      </Suspense>
    </WebDatabaseBoundary>
  );
}

export function DatabaseGate({ children }: { children: ReactNode }) {
  if (Platform.OS === 'web') return <WebDatabaseGate>{children}</WebDatabaseGate>;

  return <NativeDatabaseGate>{children}</NativeDatabaseGate>;
}

function NativeDatabaseGate({ children }: { children: ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  // SQLiteProvider calls onError during render, possibly more than once per failure.
  const [scheduled] = useState(() => new Set<number>());

  const onError = (e: Error) => {
    if (scheduled.has(attempt)) return;
    scheduled.add(attempt);
    setTimeout(() => {
      if (isLockError(e) && attempt < MAX_RETRIES) setAttempt(attempt + 1);
      else setError(e);
    }, RETRY_MS);
  };

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.bg }}>
        <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 8 }}>
          Unhooked could not open its local database.
        </Text>
        <Text style={{ fontSize: 14, color: colors.textMuted }}>{error.message}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SQLiteProvider
        key={attempt}
        databaseName={DATABASE_NAME}
        onInit={migrateDbIfNeeded}
        onError={onError}
      >
        {children}
      </SQLiteProvider>
    </View>
  );
}
