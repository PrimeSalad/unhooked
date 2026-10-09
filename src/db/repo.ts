// Repositories: the only place SQL lives. Every write logs an event (when meaningful) and
// calls bumpData() so screens refresh.

import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { Centavos } from '@/domain/money';
import { dueBy, endOfMonthDate, type DebtBalance } from '@/domain/repayment';
import { partOfDay, type PartOfDay } from '@/domain/scroll';
import type {
  PlannedPurchase,
  ScrollOutcome,
  ScrollSession,
  WellnessCheckIn,
} from '@/domain/types';

import { logEvent } from './events';
import { listDebts } from './debts';
import { evidenceSummary } from './evidence';
import { listPurchases, spentThisMonth } from './purchases';
import { bumpData } from './useDbQuery';

export { addDebt, addPayment, closeDebt, deleteDebt, listDebts } from './debts';
export type { NewDebt } from './debts';
export { addEvidence, deleteEvidence, evidenceSummary, listEvidence } from './evidence';
export { endOfMonthDate } from '@/domain/repayment';
export {
  addPurchase,
  getPurchase,
  listPurchases,
  setPurchaseStatus,
  spentThisMonth,
} from './purchases';
export type { NewPurchase } from './purchases';

const now = () => new Date().toISOString();
const uuid = () => Crypto.randomUUID();

function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// ---------- Scroll ----------

interface SessionRow {
  id: string;
  app: string;
  started_at: string;
  ended_at: string | null;
  limit_minutes: number;
  outcome: ScrollOutcome | null;
}

const toSession = (r: SessionRow): ScrollSession => ({
  id: r.id,
  app: r.app,
  startedAt: r.started_at,
  endedAt: r.ended_at,
  limitMinutes: r.limit_minutes,
  outcome: r.outcome,
});

export async function activeSession(db: SQLiteDatabase): Promise<ScrollSession | null> {
  const r = await db.getFirstAsync<SessionRow>(
    'SELECT * FROM scroll_sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1',
  );
  return r ? toSession(r) : null;
}

export async function startSession(db: SQLiteDatabase, app: string, limitMinutes: number) {
  await db.runAsync(
    'INSERT INTO scroll_sessions (id, app, started_at, limit_minutes) VALUES (?, ?, ?, ?)',
    uuid(),
    app,
    now(),
    limitMinutes,
  );
  await logEvent(db, 'scroll_session_started', { app, limitMinutes });
  bumpData();
}

/**
 * Manual entry ("I scrolled 45 min on TikTok last night"). The session is stored already
 * ended, so it feeds stats without a timer or a check-in.
 */
export async function logPastSession(
  db: SQLiteDatabase,
  app: string,
  minutes: number,
  endedAt: Date,
) {
  const startedAt = new Date(endedAt.getTime() - minutes * 60000).toISOString();
  await db.runAsync(
    'INSERT INTO scroll_sessions (id, app, started_at, ended_at, limit_minutes) VALUES (?, ?, ?, ?, ?)',
    uuid(),
    app,
    startedAt,
    endedAt.toISOString(),
    minutes,
  );
  await logEvent(db, 'scroll_session_started', { app, limitMinutes: minutes, manual: true });
  bumpData();
}

export async function setSessionOutcome(db: SQLiteDatabase, id: string, outcome: ScrollOutcome) {
  await db.runAsync('UPDATE scroll_sessions SET outcome = ? WHERE id = ?', outcome, id);
  await logEvent(db, 'scroll_checkin_answered', { outcome });
  bumpData();
}

export async function endSession(db: SQLiteDatabase, id: string) {
  await db.runAsync('UPDATE scroll_sessions SET ended_at = ? WHERE id = ?', now(), id);
  bumpData();
}

export async function logBreak(db: SQLiteDatabase) {
  await logEvent(db, 'break_taken', {});
  bumpData();
}

async function sessionsSince(db: SQLiteDatabase, iso: string): Promise<ScrollSession[]> {
  const rows = await db.getAllAsync<SessionRow>(
    'SELECT * FROM scroll_sessions WHERE started_at >= ? ORDER BY started_at',
    iso,
  );
  return rows.map(toSession);
}

const sessionMinutes = (s: ScrollSession, at: Date) =>
  Math.round(
    ((s.endedAt ? new Date(s.endedAt) : at).getTime() - new Date(s.startedAt).getTime()) / 60000,
  );

export async function scrollStats(db: SQLiteDatabase) {
  const at = new Date();
  const today = await sessionsSince(db, startOfToday());
  const week = await sessionsSince(db, daysAgo(6));
  const hours = new Map<number, number>();
  const byPartOfDay: Record<PartOfDay, number> = {
    night: 0,
    morning: 0,
    afternoon: 0,
    evening: 0,
  };
  for (const s of week) {
    const h = new Date(s.startedAt).getHours();
    const mins = sessionMinutes(s, at);
    hours.set(h, (hours.get(h) ?? 0) + mins);
    byPartOfDay[partOfDay(h)] += mins;
  }
  const peak = [...hours.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return {
    todayMinutes: today.reduce((n, s) => n + sessionMinutes(s, at), 0),
    longestToday: Math.max(0, ...today.map((s) => sessionMinutes(s, at))),
    weekMinutes: week.reduce((n, s) => n + sessionMinutes(s, at), 0),
    longestWeek: Math.max(0, ...week.map((s) => sessionMinutes(s, at))),
    weekSessions: week.length,
    peakHour: peak,
    byPartOfDay,
    breaksWeek: await countEvents(db, 'break_taken', daysAgo(6)),
  };
}

// ---------- Check-ins ----------

export async function latestCheckIn(db: SQLiteDatabase): Promise<WellnessCheckIn | null> {
  const r = await db.getFirstAsync<{
    id: string;
    stress: number;
    mood: number;
    fatigue: number;
    created_at: string;
  }>(
    'SELECT * FROM checkins WHERE created_at >= ? ORDER BY created_at DESC LIMIT 1',
    startOfToday(),
  );
  return r
    ? {
        id: r.id,
        stress: r.stress as WellnessCheckIn['stress'],
        mood: r.mood as WellnessCheckIn['mood'],
        fatigue: r.fatigue as WellnessCheckIn['fatigue'],
        createdAt: r.created_at,
      }
    : null;
}

// ---------- Events → stats ----------

async function countEvents(db: SQLiteDatabase, type: string, sinceIso: string, where = '') {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM events WHERE type = ? AND created_at >= ? ${where}`,
    type,
    sinceIso,
  );
  return row?.n ?? 0;
}

const DODGED = "AND json_extract(payload, '$.decision') != 'continue'";

/** Pauses where the user chose to wait, reconsider or take a break, per day for the last 7 days. */
export async function dodgedLast7Days(db: SQLiteDatabase): Promise<{ date: Date; n: number }[]> {
  const rows = await db.getAllAsync<{ created_at: string }>(
    `SELECT created_at FROM events WHERE type = 'pause_decision' AND created_at >= ? ${DODGED}`,
    daysAgo(6),
  );
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - 6 + i);
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    const n = rows.filter((r) => {
      const t = new Date(r.created_at);
      return t >= date && t < next;
    }).length;
    return { date, n };
  });
}

// ---------- Overview (Today, chat, pause facts) ----------

export interface Overview {
  debts: DebtBalance[];
  owedTotal: Centavos;
  lentTotal: Centavos;
  dueThisMonth: Centavos;
  nextDue: DebtBalance | null;
  cooling: PlannedPurchase[];
  spentThisMonth: Centavos;
  scroll: Awaited<ReturnType<typeof scrollStats>>;
  dodgedToday: number;
  breaksToday: number;
  evidence: { count: number; lenders: number };
  checkIn: WellnessCheckIn | null;
}

export async function getOverview(db: SQLiteDatabase): Promise<Overview> {
  const debts = await listDebts(db);
  const open = debts.filter((b) => b.outstanding > 0);
  const owe = open.filter((b) => b.debt.direction === 'owed');
  const nextDue =
    owe
      .filter((b) => b.debt.dueDate)
      .sort((a, b) => a.debt.dueDate!.localeCompare(b.debt.dueDate!))[0] ?? null;
  const purchases = await listPurchases(db);
  return {
    debts,
    owedTotal: owe.reduce((s, b) => s + b.outstanding, 0),
    lentTotal: open
      .filter((b) => b.debt.direction === 'lent')
      .reduce((s, b) => s + b.outstanding, 0),
    dueThisMonth: dueBy(debts, endOfMonthDate()),
    nextDue,
    cooling: purchases.filter((p) => p.status === 'cooling'),
    spentThisMonth: await spentThisMonth(db),
    scroll: await scrollStats(db),
    dodgedToday: await countEvents(db, 'pause_decision', startOfToday(), DODGED),
    breaksToday: await countEvents(db, 'break_taken', startOfToday()),
    evidence: await evidenceSummary(db),
    checkIn: await latestCheckIn(db),
  };
}

export const emptyOverview: Overview = {
  debts: [],
  owedTotal: 0,
  lentTotal: 0,
  dueThisMonth: 0,
  nextDue: null,
  cooling: [],
  spentThisMonth: 0,
  scroll: {
    todayMinutes: 0,
    longestToday: 0,
    weekMinutes: 0,
    longestWeek: 0,
    weekSessions: 0,
    peakHour: null,
    byPartOfDay: { night: 0, morning: 0, afternoon: 0, evening: 0 },
    breaksWeek: 0,
  },
  dodgedToday: 0,
  breaksToday: 0,
  evidence: { count: 0, lenders: 0 },
  checkIn: null,
};

// ---------- Weekly wrapped ----------

export interface WeekWrap {
  since: string;
  kept: Centavos;
  keptItems: number;
  paid: Centavos;
  payments: number;
  scrollMinutes: number;
  dodged: number;
  breaks: number;
  peakHour: number | null;
  days: { date: Date; n: number }[];
}

export async function weekWrap(db: SQLiteDatabase): Promise<WeekWrap> {
  const since = daysAgo(6);
  const kept = await db.getFirstAsync<{ s: number | null; n: number }>(
    "SELECT SUM(price) AS s, COUNT(*) AS n FROM purchases WHERE status = 'skipped' AND created_at >= ?",
    since,
  );
  const paid = await db.getFirstAsync<{ s: number | null; n: number }>(
    'SELECT SUM(amount) AS s, COUNT(*) AS n FROM payments WHERE paid_at >= ?',
    since,
  );
  const scroll = await scrollStats(db);
  const shieldClosed = await countEvents(
    db,
    'block_decision',
    since,
    "AND json_extract(payload, '$.decision') != 'open'",
  );
  return {
    since,
    kept: kept?.s ?? 0,
    keptItems: kept?.n ?? 0,
    paid: paid?.s ?? 0,
    payments: paid?.n ?? 0,
    scrollMinutes: scroll.weekMinutes,
    dodged: (await countEvents(db, 'pause_decision', since, DODGED)) + shieldClosed,
    breaks: await countEvents(db, 'break_taken', since),
    peakHour: scroll.peakHour,
    days: await dodgedLast7Days(db),
  };
}

export const emptyWeekWrap: WeekWrap = {
  since: new Date().toISOString(),
  kept: 0,
  keptItems: 0,
  paid: 0,
  payments: 0,
  scrollMinutes: 0,
  dodged: 0,
  breaks: 0,
  peakHour: null,
  days: [],
};
