// Display helpers shared by screens. Dates in the DB are ISO (YYYY-MM-DD for due dates).

const DAY = 24 * 3600 * 1000;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function daysUntil(dateIso: string, from = new Date()): number {
  const target = startOfDay(new Date(`${dateIso.slice(0, 10)}T00:00:00`));
  return Math.round((target.getTime() - startOfDay(from).getTime()) / DAY);
}

export function shortDate(dateIso: string): string {
  return new Date(`${dateIso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
  });
}

/** "Due Oct 15 · in 6 days", "Due today", "Overdue by 2 days". */
export function dueLabel(dateIso: string | null): string {
  if (!dateIso) return 'No due date';
  const n = daysUntil(dateIso);
  if (n < 0) return `Overdue by ${-n} ${n === -1 ? 'day' : 'days'}`;
  if (n === 0) return 'Due today';
  if (n === 1) return 'Due tomorrow';
  return `Due ${shortDate(dateIso)} · in ${n} days`;
}

export function isUrgent(dateIso: string | null): boolean {
  return !!dateIso && daysUntil(dateIso) <= 7;
}

/** Local date (YYYY-MM-DD) `days` from today. */
export function dateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "23h 12m left" for a future ISO time, or null if it has passed. */
export function timeLeft(untilIso: string): string | null {
  const ms = new Date(untilIso).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

export function greeting(name: string): string {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${part}, ${name}` : part;
}
