// Scroll session helpers.

import type { ScrollSession } from './types';

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
