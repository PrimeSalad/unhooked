import type { WellnessCheckIn } from './types';
import { localDateKey } from '@/lib/dateOnly';

type Ratings = Pick<WellnessCheckIn, 'mood' | 'stress' | 'fatigue'>;

export interface DailyFeeling {
  label: string;
  fish: 'worried' | 'sleepy' | 'thinking' | 'calm' | 'happy' | 'proud';
}

/** A gentle summary of the three answers, anchored to the user's own mood rating. */
export function dailyFeeling({ mood, stress, fatigue }: Ratings): DailyFeeling {
  const heavy = stress >= 4 || fatigue >= 4;
  if (mood <= 2)
    return heavy ? { label: 'Tough day', fish: 'worried' } : { label: 'Low mood', fish: 'sleepy' };
  if (mood >= 4) {
    if (heavy) return { label: 'Mixed day', fish: 'thinking' };
    return mood === 5 && stress <= 2 && fatigue <= 2
      ? { label: 'Feeling great', fish: 'proud' }
      : { label: 'Feeling good', fish: 'happy' };
  }
  if (stress >= 4 && fatigue >= 4) return { label: 'Drained day', fish: 'sleepy' };
  if (stress >= 4) return { label: 'Stressful day', fish: 'worried' };
  if (fatigue >= 4) return { label: 'Tired day', fish: 'sleepy' };
  return { label: 'Steady day', fish: 'calm' };
}

export interface MoodDay {
  date: Date;
  mood: WellnessCheckIn['mood'] | null;
}

/** Seven local calendar days ending on the latest saved check-in, including skipped days. */
export function recentMoodDays(checkIns: WellnessCheckIn[]): MoodDay[] {
  const latestCheckIn = checkIns[0];
  if (!latestCheckIn) return [];
  const latest = new Date(latestCheckIn.createdAt);
  latest.setHours(0, 0, 0, 0);
  const saved = new Map<string, WellnessCheckIn['mood']>();
  for (const checkIn of checkIns) {
    const day = localDateKey(new Date(checkIn.createdAt));
    if (!saved.has(day)) saved.set(day, checkIn.mood);
  }
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(latest);
    date.setDate(latest.getDate() - 6 + index);
    return { date, mood: saved.get(localDateKey(date)) ?? null };
  });
}
