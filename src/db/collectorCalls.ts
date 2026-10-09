// Flagged collector calls: each becomes an event (for the Calls list and insights) and an
// Evidence Pack entry the user can use in a complaint. Nothing leaves the phone.

import type { SQLiteDatabase } from 'expo-sqlite';

import { parseScreenedCalls, screenedCallNote, type ScreenedCall } from '@/domain/callScreen';

import { eventsSince, logEvent } from './events';
import { addEvidence } from './evidence';

const localDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export async function saveScreenedCalls(db: SQLiteDatabase, calls: ScreenedCall[]): Promise<void> {
  for (const call of calls) {
    await logEvent(db, 'collector_call_flagged', { ...call });
    await addEvidence(db, {
      lender: call.label ?? call.number,
      incidentDate: localDate(call.at),
      note: screenedCallNote(call),
    });
  }
}

/** Flagged calls from the last 30 days, newest first. */
export async function recentFlaggedCalls(db: SQLiteDatabase): Promise<ScreenedCall[]> {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const events = (await eventsSince(db, since)).filter((e) => e.type === 'collector_call_flagged');
  return parseScreenedCalls(JSON.stringify(events.map((e) => e.payload)));
}
