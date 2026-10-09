// Local-first storage. All sensitive data lives in this on-device SQLite DB.
// Bump DATABASE_VERSION and append a step for every schema change; never edit a shipped step.

import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'unhooked.db';
const DATABASE_VERSION = 1;

const steps: Record<number, string> = {
  1: `
    PRAGMA journal_mode = 'wal';
    PRAGMA foreign_keys = ON;

    CREATE TABLE debts (
      id TEXT PRIMARY KEY NOT NULL,
      direction TEXT NOT NULL CHECK (direction IN ('owed','lent')),
      counterparty TEXT NOT NULL,
      principal INTEGER NOT NULL,
      interest_rate_pct REAL,
      due_date TEXT,
      terms TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      closed_at TEXT
    );

    CREATE TABLE payments (
      id TEXT PRIMARY KEY NOT NULL,
      debt_id TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      paid_at TEXT NOT NULL,
      note TEXT
    );

    CREATE TABLE evidence (
      id TEXT PRIMARY KEY NOT NULL,
      debt_id TEXT REFERENCES debts(id) ON DELETE SET NULL,
      lender TEXT NOT NULL,
      incident_date TEXT NOT NULL,
      image_uri TEXT,
      message_text TEXT,
      risk_level TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE purchases (
      id TEXT PRIMARY KEY NOT NULL,
      item TEXT NOT NULL,
      price INTEGER NOT NULL,
      is_need INTEGER NOT NULL DEFAULT 0,
      planned_date TEXT,
      alternative_price INTEGER,
      status TEXT NOT NULL DEFAULT 'planned',
      cooling_until TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE scroll_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      app TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      limit_minutes INTEGER NOT NULL,
      outcome TEXT
    );

    CREATE TABLE checkins (
      id TEXT PRIMARY KEY NOT NULL,
      stress INTEGER NOT NULL,
      mood INTEGER NOT NULL,
      fatigue INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE events (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
    CREATE INDEX idx_events_created ON events(created_at);
    CREATE INDEX idx_payments_debt ON payments(debt_id);
  `,
};

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let current = row?.user_version ?? 0;
  if (current >= DATABASE_VERSION) {
    await db.execAsync('PRAGMA foreign_keys = ON;');
    return;
  }
  while (current < DATABASE_VERSION) {
    const next = current + 1;
    const sql = steps[next];
    if (!sql) throw new Error(`Missing migration step ${next}`);
    await db.execAsync(sql);
    current = next;
  }
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

/** Privacy control: wipes every user record. Used by Settings → "Delete all my data". */
export async function deleteAllData(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    DELETE FROM payments; DELETE FROM evidence; DELETE FROM debts;
    DELETE FROM purchases; DELETE FROM scroll_sessions;
    DELETE FROM checkins; DELETE FROM events;
  `);
  // TODO(P2): also delete evidence image files from the document directory.
}
