// Opens the local database for the whole app.
// On web, a reload or a second tab can briefly hold the OPFS file lock from the previous page,
// so lock errors are retried a few times before the error screen is shown.

import { SQLiteProvider } from 'expo-sqlite';
import { useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { colors } from '@/constants/theme';

import { DATABASE_NAME, migrateDbIfNeeded } from './migrations';

const MAX_RETRIES = 8;
const RETRY_MS = 400;

const isLockError = (e: Error) =>
  /Access Handle|NoModificationAllowed|Invalid VFS state|database is locked/i.test(e.message);

export function DatabaseGate({ children }: { children: ReactNode }) {
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
