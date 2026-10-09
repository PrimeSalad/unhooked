// Scroll session helpers.

import type { ScrollSession } from './types';

// ---------- Break suggestions ----------

export interface BreakIdea {
  id: string;
  title: string;
  steps: string[];
}

/** Short, low-effort breaks. Rotate so the suggestion never feels like a lecture. */
export const BREAK_IDEAS: BreakIdea[] = [
  {
    id: 'stretch',
    title: 'Stretch with me',
    steps: [
      'Roll your shoulders back five times',
      'Look at something far away for 20 seconds',
      'Drink a glass of water',
    ],
  },
  {
    id: 'walk',
    title: 'Take a short walk',
    steps: [
      'Stand up and walk for two minutes',
      'Notice three things around you',
      'Take five slow breaths before heading back',
    ],
  },
  {
    id: 'water',
    title: 'Water break',
    steps: [
      'Fill a glass of water',
      'Drink it slowly, away from the screen',
      'Roll your neck gently side to side',
    ],
  },
  {
    id: 'task',
    title: 'Finish one small thing',
    steps: [
      'Pick one tiny task you have been putting off',
      'Do just that one thing — two minutes counts',
      'Notice how it feels to have it done',
    ],
  },
  {
    id: 'offline',
    title: 'Do something offline',
    steps: [
      'Put the phone face down',
      'Step outside, tidy one surface, or say hi to someone',
      'Come back only if you still want to',
    ],
  },
];

/** Picks a break idea, never repeating the last one shown. `rand` is injectable for tests. */
export function pickBreakIdea(lastId: string | null, rand: () => number = Math.random): BreakIdea {
  const pool = BREAK_IDEAS.filter((i) => i.id !== lastId);
  const list = pool.length ? pool : BREAK_IDEAS;
  return list[Math.min(list.length - 1, Math.floor(rand() * list.length))]!;
}

// ---------- Time-of-day ----------

export type PartOfDay = 'night' | 'morning' | 'afternoon' | 'evening';

export const PART_OF_DAY_LABELS: Record<PartOfDay, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Night',
};

/** Buckets a local hour (0–23) for the scroll-time histogram. */
export function partOfDay(hour: number): PartOfDay {
  if (hour < 6) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

export function elapsedSeconds(session: ScrollSession, now: Date): number {
  const end = session.endedAt ? new Date(session.endedAt) : now;
  return Math.max(0, Math.floor((end.getTime() - new Date(session.startedAt).getTime()) / 1000));
}

export function shouldCheckIn(session: ScrollSession, now: Date): boolean {
  return !session.endedAt && elapsedSeconds(session, now) >= session.limitMinutes * 60;
}

export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function formatMinutes(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
