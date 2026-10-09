import type { SQLiteDatabase } from 'expo-sqlite';

import { logEventAndRefresh } from './events';

export async function dismissInsight(db: SQLiteDatabase, id: string): Promise<void> {
  await logEventAndRefresh(db, 'insight_dismissed', { id });
}
