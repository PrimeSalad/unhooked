import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { WellnessCheckIn } from '@/domain/types';

import { logEvent } from './events';
import { bumpData } from './useDbQuery';

type Ratings = Pick<WellnessCheckIn, 'stress' | 'mood' | 'fatigue'>;

interface CheckInRow {
  id: string;
  stress: number;
  mood: number;
  fatigue: number;
  created_at: string;
}

/** Newest first; check-in history stays on the device with the rest of the app data. */
export async function listCheckIns(db: SQLiteDatabase): Promise<WellnessCheckIn[]> {
  const rows = await db.getAllAsync<CheckInRow>(
    'SELECT id, stress, mood, fatigue, created_at FROM checkins ORDER BY created_at DESC',
  );
  return rows.map((row) => ({
    id: row.id,
    stress: row.stress as WellnessCheckIn['stress'],
    mood: row.mood as WellnessCheckIn['mood'],
    fatigue: row.fatigue as WellnessCheckIn['fatigue'],
    createdAt: row.created_at,
  }));
}

/** An atomic insert prevents a second check-in in the phone's current local day. */
export async function saveTodayCheckIn(db: SQLiteDatabase, ratings: Ratings): Promise<boolean> {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const result = await db.runAsync(
    `INSERT INTO checkins (id, stress, mood, fatigue, created_at)
     SELECT ?, ?, ?, ?, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM checkins WHERE created_at >= ? AND created_at < ?
     )`,
    Crypto.randomUUID(),
    ratings.stress,
    ratings.mood,
    ratings.fatigue,
    now.toISOString(),
    start.toISOString(),
    end.toISOString(),
  );
  if (result.changes === 0) return false;

  try {
    await logEvent(db, 'checkin_completed', ratings);
  } catch (error) {
    console.warn('Could not record check-in activity', error);
  } finally {
    bumpData();
  }
  return true;
}
