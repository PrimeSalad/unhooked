// Append-only event log. Every meaningful user action records one event;
// insights (Phase 5) and success metrics are derived from here, never from UI state.

import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { AppEvent, AppEventType } from '@/domain/types';

import { bumpData } from './useDbQuery';

export async function logEvent(
  db: SQLiteDatabase,
  type: AppEventType,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await db.runAsync(
    'INSERT INTO events (id, type, payload, created_at) VALUES ($id, $type, $payload, $createdAt)',
    {
      $id: Crypto.randomUUID(),
      $type: type,
      $payload: JSON.stringify(payload),
      $createdAt: new Date().toISOString(),
    },
  );
}

/** For actions recorded only in events, so mounted dashboards refresh after the write. */
export async function logEventAndRefresh(
  db: SQLiteDatabase,
  type: AppEventType,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await logEvent(db, type, payload);
  bumpData();
}

export async function eventsSince(db: SQLiteDatabase, sinceIso: string): Promise<AppEvent[]> {
  const rows = await db.getAllAsync<{
    id: string;
    type: AppEventType;
    payload: string;
    created_at: string;
  }>(
    'SELECT id, type, payload, created_at FROM events WHERE created_at >= ? ORDER BY created_at DESC',
    sinceIso,
  );
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    payload: JSON.parse(r.payload) as Record<string, unknown>,
    createdAt: r.created_at,
  }));
}

/** Includes the full current week and seven-day insight dismissal window. */
export function recentEvents(db: SQLiteDatabase): Promise<AppEvent[]> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - 7);
  return eventsSince(db, since.toISOString());
}
