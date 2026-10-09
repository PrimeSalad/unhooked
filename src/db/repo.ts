// Repositories: the only place SQL lives. Every write logs an event (when meaningful) and
// calls bumpData() so screens refresh.

import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { Centavos } from '@/domain/money';
import { balances, dueBy, type DebtBalance } from '@/domain/repayment';
import type {
  Debt,
  DebtDirection,
  Payment,
  PlannedPurchase,
  PurchaseStatus,
  RiskLevel,
  ScrollOutcome,
  ScrollSession,
  WellnessCheckIn,
} from '@/domain/types';

import { logEvent } from './events';
import { bumpData } from './useDbQuery';
import { persistEvidenceImage } from '@/lib/evidenceFiles';

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

export function endOfMonthDate(): string {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
}

// ---------- Debts ----------

interface DebtRow {
  id: string;
  direction: DebtDirection;
  counterparty: string;
  principal: number;
  interest_rate_pct: number | null;
  due_date: string | null;
  terms: string | null;
  notes: string | null;
  created_at: string;
  closed_at: string | null;
}

const toDebt = (r: DebtRow): Debt => ({
  id: r.id,
  direction: r.direction,
  counterparty: r.counterparty,
  principal: r.principal,
  interestRatePct: r.interest_rate_pct,
  dueDate: r.due_date,
  terms: r.terms,
  notes: r.notes,
  createdAt: r.created_at,
  closedAt: r.closed_at,
});

export async function listDebts(db: SQLiteDatabase): Promise<DebtBalance[]> {
  const rows = await db.getAllAsync<DebtRow>('SELECT * FROM debts ORDER BY created_at DESC');
  const pays = await db.getAllAsync<{
    id: string;
    debt_id: string;
    amount: number;
    paid_at: string;
    note: string | null;
  }>('SELECT * FROM payments');
  const payments: Payment[] = pays.map((p) => ({
    id: p.id,
    debtId: p.debt_id,
    amount: p.amount,
    paidAt: p.paid_at,
    note: p.note,
  }));
  return balances(rows.map(toDebt), payments);
}

export interface NewDebt {
  direction: DebtDirection;
  counterparty: string;
  principal: Centavos;
  dueDate: string | null;
  interestRatePct: number | null;
  notes: string | null;
}

export async function addDebt(db: SQLiteDatabase, d: NewDebt): Promise<void> {
  const id = uuid();
  await db.runAsync(
    `INSERT INTO debts (id, direction, counterparty, principal, interest_rate_pct, due_date, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    d.direction,
    d.counterparty,
    d.principal,
    d.interestRatePct,
    d.dueDate,
    d.notes,
    now(),
  );
  await logEvent(db, 'debt_added', { direction: d.direction });
  bumpData();
}

export async function addPayment(db: SQLiteDatabase, debtId: string, amount: Centavos) {
  await db.runAsync(
    'INSERT INTO payments (id, debt_id, amount, paid_at) VALUES (?, ?, ?, ?)',
    uuid(),
    debtId,
    amount,
    now(),
  );
  await logEvent(db, 'payment_recorded', { amount });
  bumpData();
}

export async function deleteDebt(db: SQLiteDatabase, debtId: string) {
  await db.runAsync('DELETE FROM debts WHERE id = ?', debtId);
  bumpData();
}

// ---------- Evidence ----------

export async function evidenceSummary(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ n: number; lenders: number }>(
    'SELECT COUNT(*) AS n, COUNT(DISTINCT lender) AS lenders FROM evidence',
  );
  return { count: row?.n ?? 0, lenders: row?.lenders ?? 0 };
}

export async function addEvidence(
  db: SQLiteDatabase,
  e: {
    lender: string;
    imageUri?: string | null;
    messageText?: string | null;
    riskLevel?: RiskLevel | null;
  },
) {
  const imageUri = e.imageUri ? await persistEvidenceImage(e.imageUri) : null;
  await db.runAsync(
    `INSERT INTO evidence (id, lender, incident_date, image_uri, message_text, risk_level, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    uuid(),
    e.lender,
    now(),
    imageUri,
    e.messageText ?? null,
    e.riskLevel ?? null,
    now(),
  );
  await logEvent(db, 'evidence_added', { kind: e.imageUri ? 'screenshot' : 'message' });
  bumpData();
}

// ---------- Purchases ----------

interface PurchaseRow {
  id: string;
  item: string;
  price: number;
  is_need: number;
  planned_date: string | null;
  alternative_price: number | null;
  status: PurchaseStatus;
  cooling_until: string | null;
  created_at: string;
}

const toPurchase = (r: PurchaseRow): PlannedPurchase => ({
  id: r.id,
  item: r.item,
  price: r.price,
  isNeed: r.is_need === 1,
  plannedDate: r.planned_date,
  alternativePrice: r.alternative_price,
  status: r.status,
  coolingUntil: r.cooling_until,
  createdAt: r.created_at,
});

export async function listPurchases(db: SQLiteDatabase): Promise<PlannedPurchase[]> {
  const rows = await db.getAllAsync<PurchaseRow>(
    'SELECT * FROM purchases ORDER BY created_at DESC',
  );
  return rows.map(toPurchase);
}

export async function getPurchase(db: SQLiteDatabase, id: string) {
  const r = await db.getFirstAsync<PurchaseRow>('SELECT * FROM purchases WHERE id = ?', id);
  return r ? toPurchase(r) : null;
}

export async function addPurchase(
  db: SQLiteDatabase,
  p: { item: string; price: Centavos; isNeed: boolean },
): Promise<string> {
  const id = uuid();
  await db.runAsync(
    'INSERT INTO purchases (id, item, price, is_need, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    p.item,
    p.price,
    p.isNeed ? 1 : 0,
    'planned',
    now(),
  );
  await logEvent(db, 'purchase_evaluated', { price: p.price, isNeed: p.isNeed });
  bumpData();
  return id;
}

export async function setPurchaseStatus(db: SQLiteDatabase, id: string, status: PurchaseStatus) {
  const until = status === 'cooling' ? new Date(Date.now() + 24 * 3600 * 1000).toISOString() : null;
  await db.runAsync(
    'UPDATE purchases SET status = ?, cooling_until = ? WHERE id = ?',
    status,
    until,
    id,
  );
  if (status === 'cooling') await logEvent(db, 'purchase_saved_for_later', { id });
  bumpData();
  return until;
}

export async function spentThisMonth(db: SQLiteDatabase): Promise<Centavos> {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
  const row = await db.getFirstAsync<{ s: number | null }>(
    "SELECT SUM(price) AS s FROM purchases WHERE status = 'bought' AND created_at >= ?",
    start,
  );
  return row?.s ?? 0;
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
  for (const s of week) {
    const h = new Date(s.startedAt).getHours();
    hours.set(h, (hours.get(h) ?? 0) + sessionMinutes(s, at));
  }
  const peak = [...hours.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return {
    todayMinutes: today.reduce((n, s) => n + sessionMinutes(s, at), 0),
    longestToday: Math.max(0, ...today.map((s) => sessionMinutes(s, at))),
    weekMinutes: week.reduce((n, s) => n + sessionMinutes(s, at), 0),
    weekSessions: week.length,
    peakHour: peak,
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
  scroll: { todayMinutes: 0, longestToday: 0, weekMinutes: 0, weekSessions: 0, peakHour: null },
  dodgedToday: 0,
  breaksToday: 0,
  evidence: { count: 0, lenders: 0 },
  checkIn: null,
};
