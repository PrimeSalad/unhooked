// Pure trial math. Dates are epoch milliseconds so the caller controls the clock.

export interface TrialStatus {
  expired: boolean;
  /** When the trial ends (install + days, capped by the hard expiry). */
  endsAt: number;
  /** Milliseconds left, never negative. */
  remainingMs: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Clock rolled back further than this (before install, or before the last open) counts as tampering. */
const CLOCK_SLACK_MS = 60 * 60 * 1000;

export function trialStatus(
  installedAt: number,
  now: number,
  days: number,
  hardExpiryAt: number,
  /** Latest clock reading this install has seen; guards against setting the date back. */
  lastSeenAt: number = installedAt,
): TrialStatus {
  const endsAt = Math.min(installedAt + days * DAY_MS, hardExpiryAt);
  const rolledBack = now < Math.max(installedAt, lastSeenAt) - CLOCK_SLACK_MS;
  const expired = rolledBack || now >= endsAt;
  return { expired, endsAt, remainingMs: expired ? 0 : endsAt - now };
}

/** "1 day 4 h", "3 h 20 min", "12 min", "less than a minute". */
export function formatRemaining(ms: number): string {
  if (ms < 60_000) return 'less than a minute';
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days >= 1) {
    const h = hours % 24;
    return h ? `${days} day${days > 1 ? 's' : ''} ${h} h` : `${days} day${days > 1 ? 's' : ''}`;
  }
  if (hours >= 1) {
    const m = minutes % 60;
    return m ? `${hours} h ${m} min` : `${hours} h`;
  }
  return `${minutes} min`;
}
