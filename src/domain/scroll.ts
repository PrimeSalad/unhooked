// Scroll session helpers (plan.md Phase 4).

import type { ScrollSession } from './types';

export function elapsedMinutes(_session: ScrollSession, _now: Date): number {
  throw new Error('TODO(P4): implement elapsedMinutes');
}

export function shouldCheckIn(_session: ScrollSession, _now: Date): boolean {
  throw new Error('TODO(P4): implement shouldCheckIn');
}
