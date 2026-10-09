import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { isValidIncidentDate } from '@/domain/evidence';
import { normalizeMobile } from '@/domain/numberLog';
import type { NumberReport } from '@/domain/types';

import { logEvent } from './events';
import { bumpData } from './useDbQuery';

interface NumberReportRow {
  id: string;
  number: string;
  agent_name: string | null;
  seen_on: string;
  note: string | null;
  created_at: string;
}

const fromRow = (row: NumberReportRow): NumberReport => ({
  id: row.id,
  number: row.number,
  agentName: row.agent_name,
  seenOn: row.seen_on,
  note: row.note,
  createdAt: row.created_at,
});

export async function listNumberReports(db: SQLiteDatabase): Promise<NumberReport[]> {
  const rows = await db.getAllAsync<NumberReportRow>(
    'SELECT id, number, agent_name, seen_on, note, created_at FROM number_reports ORDER BY seen_on DESC, created_at DESC',
  );
  return rows.map(fromRow);
}

export interface NewNumberReport {
  number: string;
  agentName?: string | null;
  seenOn: string;
  note?: string | null;
}

/** Records only numbers the user selected or entered; OCR candidates are never saved by default. */
export async function addNumberReports(
  db: SQLiteDatabase,
  entries: NewNumberReport[],
): Promise<number> {
  const clean = entries.map((entry) => {
    const number = normalizeMobile(entry.number);
    if (!number || !isValidIncidentDate(entry.seenOn))
      throw new Error('Check the phone number and incident date.');
    return {
      id: Crypto.randomUUID(),
      number,
      agentName: entry.agentName?.trim().slice(0, 80) || null,
      seenOn: entry.seenOn,
      note: entry.note?.trim().slice(0, 500) || null,
      createdAt: new Date().toISOString(),
    };
  });
  await db.withTransactionAsync(async () => {
    for (const report of clean) {
      await db.runAsync(
        'INSERT INTO number_reports (id, number, agent_name, seen_on, note, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        report.id,
        report.number,
        report.agentName,
        report.seenOn,
        report.note,
        report.createdAt,
      );
    }
  });
  if (clean.length) {
    try {
      await logEvent(db, 'number_reported', { count: clean.length });
    } catch (error) {
      console.warn('Could not record number log activity', error);
    } finally {
      bumpData();
    }
  }
  return clean.length;
}

/** IDs are preserved so an export imported twice cannot duplicate existing reports. */
export async function importNumberReports(
  db: SQLiteDatabase,
  reports: NumberReport[],
): Promise<number> {
  let added = 0;
  await db.withTransactionAsync(async () => {
    for (const report of reports) {
      const result = await db.runAsync(
        'INSERT OR IGNORE INTO number_reports (id, number, agent_name, seen_on, note, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        report.id,
        report.number,
        report.agentName,
        report.seenOn,
        report.note,
        report.createdAt,
      );
      added += result.changes;
    }
  });
  if (added) {
    try {
      await logEvent(db, 'number_log_imported', { count: added });
    } catch (error) {
      console.warn('Could not record number log import activity', error);
    } finally {
      bumpData();
    }
  }
  return added;
}

export async function removeNumberReports(db: SQLiteDatabase, number: string): Promise<void> {
  const result = await db.runAsync('DELETE FROM number_reports WHERE number = ?', number);
  if (result.changes) {
    try {
      await logEvent(db, 'number_removed', { count: result.changes });
    } catch (error) {
      console.warn('Could not record number removal activity', error);
    } finally {
      bumpData();
    }
  }
}
