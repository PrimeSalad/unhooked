// Safe-to-spend per day until the next payday. Pure; an estimate from the user's own budget.

import type { Centavos } from './money';
import type { BudgetProfile } from './types';

const lastDayOf = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Next payday strictly after today (local). Twice-monthly = 15th and 30th (or month end). */
export function nextPayday(payday: BudgetProfile['payday'], today = new Date()): Date {
  const t = startOfDay(today);
  const y = t.getFullYear();
  const m = t.getMonth();
  const candidates: Date[] = [];
  for (const [yy, mm] of [
    [y, m],
    [m === 11 ? y + 1 : y, (m + 1) % 12],
  ] as const) {
    const last = lastDayOf(yy, mm);
    if (payday === '15_30') {
      candidates.push(new Date(yy, mm, 15), new Date(yy, mm, Math.min(30, last)));
    } else if (typeof payday === 'number') {
      candidates.push(new Date(yy, mm, Math.min(payday, last)));
    } else {
      candidates.push(new Date(yy, mm, last));
    }
  }
  return candidates.find((d) => d.getTime() > t.getTime()) ?? candidates[candidates.length - 1]!;
}

export function daysUntil(date: Date, today = new Date()): number {
  return Math.max(
    1,
    Math.round((startOfDay(date).getTime() - startOfDay(today).getTime()) / 86400000),
  );
}

/** Free money split evenly across the days left until payday. Never negative. */
export function dailyAllowance(free: Centavos, days: number): Centavos {
  if (free <= 0 || days <= 0) return 0;
  return Math.floor(free / days);
}
