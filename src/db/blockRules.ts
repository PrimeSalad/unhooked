// Guard rules + sync to the native guard. Only apps/sites the user picked are stored.

import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { syncGuard } from '@/lib/guard';
import type { GuardKind, GuardMode, GuardRule, Schedule } from '@/domain/blocking';

import { logEvent } from './events';
import { bumpData } from './useDbQuery';

interface Row {
  id: string;
  kind: GuardKind;
  target: string;
  label: string;
  mode: GuardMode;
  schedule_json: string | null;
  enabled: number;
  created_at: string;
}

const toRule = (r: Row): GuardRule => ({
  id: r.id,
  kind: r.kind,
  target: r.target,
  label: r.label,
  mode: r.mode,
  schedule: r.schedule_json ? (JSON.parse(r.schedule_json) as Schedule) : null,
  enabled: r.enabled === 1,
  createdAt: r.created_at,
});

export async function listRules(db: SQLiteDatabase): Promise<GuardRule[]> {
  const rows = await db.getAllAsync<Row>('SELECT * FROM block_rules ORDER BY kind, label');
  return rows.map(toRule);
}

async function afterChange(db: SQLiteDatabase) {
  bumpData();
  await syncGuard(await listRules(db));
}

export async function addRules(
  db: SQLiteDatabase,
  items: { kind: GuardKind; target: string; label: string }[],
  opts: { mode: GuardMode; schedule: Schedule | null },
) {
  for (const it of items) {
    await db.runAsync(
      `INSERT INTO block_rules (id, kind, target, label, mode, schedule_json, enabled, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)
       ON CONFLICT(kind, target) DO UPDATE SET mode = excluded.mode, schedule_json = excluded.schedule_json, enabled = 1`,
      Crypto.randomUUID(),
      it.kind,
      it.target,
      it.label,
      opts.mode,
      opts.schedule ? JSON.stringify(opts.schedule) : null,
      new Date().toISOString(),
    );
    await logEvent(db, 'block_rule_added', { kind: it.kind });
  }
  await afterChange(db);
}

export async function setRuleEnabled(db: SQLiteDatabase, id: string, enabled: boolean) {
  await db.runAsync('UPDATE block_rules SET enabled = ? WHERE id = ?', enabled ? 1 : 0, id);
  await afterChange(db);
}

export async function updateRule(
  db: SQLiteDatabase,
  id: string,
  patch: { mode: GuardMode; schedule: Schedule | null },
) {
  await db.runAsync(
    'UPDATE block_rules SET mode = ?, schedule_json = ? WHERE id = ?',
    patch.mode,
    patch.schedule ? JSON.stringify(patch.schedule) : null,
    id,
  );
  await afterChange(db);
}

export async function removeRule(db: SQLiteDatabase, id: string) {
  await db.runAsync('DELETE FROM block_rules WHERE id = ?', id);
  await logEvent(db, 'block_rule_removed', {});
  await afterChange(db);
}

/** Times each guarded target was opened (shield shown) today: one sec's "attempts" counter. */
export async function attemptsToday(db: SQLiteDatabase): Promise<Record<string, number>> {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const rows = await db.getAllAsync<{ target: string | null; n: number }>(
    `SELECT json_extract(payload, '$.target') AS target, COUNT(*) AS n FROM events
     WHERE type = 'block_shield_shown' AND created_at >= ? GROUP BY target`,
    d.toISOString(),
  );
  return Object.fromEntries(rows.filter((r) => r.target).map((r) => [r.target!, r.n]));
}
