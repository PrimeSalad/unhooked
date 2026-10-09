// Reactive reads: every write calls `bumpData()`, and every `useDbQuery` re-runs.

import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { create } from 'zustand';

const useDataVersion = create<{ v: number }>(() => ({ v: 0 }));

export function bumpData() {
  useDataVersion.setState((s) => ({ v: s.v + 1 }));
}

/** Runs `query` now and again after every write. `query` should be a stable, module-level function. */
export function useDbQuery<T>(query: (db: SQLiteDatabase) => Promise<T>, initial: T) {
  const db = useSQLiteContext();
  const version = useDataVersion((s) => s.v);
  const [state, setState] = useState({ data: initial, loaded: false });

  useEffect(() => {
    let alive = true;
    query(db)
      .then((data) => alive && setState({ data, loaded: true }))
      .catch((e: unknown) => console.warn('useDbQuery failed', e));
    return () => {
      alive = false;
    };
  }, [db, query, version]);

  return state;
}
