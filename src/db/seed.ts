// Demo data for the pitch (plan.md §5): persona Ana, 24, BPO agent with OLA + BNPL debt.
// Dev builds only. Replaces existing records so the demo always starts from the same story.

import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { toCentavos } from '@/domain/money';
import { useSettings } from '@/store/settings';

import { deleteAllData } from './migrations';
import { bumpData } from './useDbQuery';

const id = () => Crypto.randomUUID();

/** ISO time `days` ago (negative = future) at hh:mm local. */
function at(days: number, hh = 12, mm = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

/** Local date YYYY-MM-DD, `days` from today. */
function dateIn(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function loadDemoData(db: SQLiteDatabase): Promise<void> {
  await deleteAllData(db);

  // Debts: two lenders, one BNPL plan, one friend who owes Ana.
  const debts: [string, 'owed' | 'lent', string, number, number | null, string | null, string][] = [
    [id(), 'owed', 'Pera Agad', 4000, 15, dateIn(6), 'Online lending app'],
    [id(), 'owed', 'Phone installment', 7200, 3, dateIn(13), 'Pay-later plan, 6 payments'],
    [id(), 'owed', 'Tita Baby', 2500, null, null, 'Family loan, pay when able'],
    [id(), 'lent', 'Jessa', 1500, null, dateIn(21), 'For tuition'],
  ];
  for (const [did, dir, who, amount, rate, due, note] of debts) {
    await db.runAsync(
      `INSERT INTO debts (id, direction, counterparty, principal, interest_rate_pct, due_date, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      did,
      dir,
      who,
      toCentavos(amount),
      rate,
      due,
      note,
      at(20),
    );
  }
  const pay = async (debtIndex: number, amount: number, daysAgo: number) =>
    db.runAsync(
      'INSERT INTO payments (id, debt_id, amount, paid_at) VALUES (?, ?, ?, ?)',
      id(),
      debts[debtIndex]![0],
      toCentavos(amount),
      at(daysAgo),
    );
  await pay(0, 1000, 9);
  await pay(1, 4800, 5);
  await pay(2, 500, 12);

  // Evidence: one threatening collector message.
  await db.runAsync(
    `INSERT INTO evidence (id, debt_id, lender, incident_date, message_text, risk_level, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id(),
    debts[0]![0],
    'Pera Agad',
    at(2, 21, 14),
    'PAY NOW OR WE WILL CONTACT YOUR FAMILY AND POST YOUR INFORMATION. Last warning today.',
    'high',
    at(2, 21, 15),
  );

  // Purchases: one cooling off, one skipped (money kept), one bought.
  const purchase = (
    item: string,
    price: number,
    status: string,
    created: string,
    until: string | null,
  ) =>
    db.runAsync(
      `INSERT INTO purchases (id, item, price, is_need, status, cooling_until, created_at, bought_at)
       VALUES (?, ?, ?, 0, ?, ?, ?, ?)`,
      id(),
      item,
      toCentavos(price),
      status,
      until,
      created,
      status === 'bought' ? created : null,
    );
  await purchase(
    'Wireless earbuds',
    4500,
    'cooling',
    at(0, 9, 40),
    new Date(Date.now() + 14 * 3600e3).toISOString(),
  );
  await purchase('Sneakers sale', 3200, 'skipped', at(3, 22, 5), null);
  await purchase('Groceries top-up', 850, 'bought', at(4, 18, 30), null);

  // Scroll: late-night TikTok habit across the week, plus today.
  for (const [days, hh, mins, app] of [
    [6, 23, 42, 'TikTok'],
    [5, 23, 35, 'TikTok'],
    [4, 22, 28, 'Facebook'],
    [3, 23, 51, 'TikTok'],
    [2, 0, 33, 'TikTok'],
    [1, 23, 24, 'Instagram'],
    [0, 8, 18, 'TikTok'],
  ] as const) {
    const start = at(days, hh, 10);
    const end = new Date(new Date(start).getTime() + mins * 60000).toISOString();
    await db.runAsync(
      `INSERT INTO scroll_sessions (id, app, started_at, ended_at, limit_minutes, outcome) VALUES (?, ?, ?, ?, 20, ?)`,
      id(),
      app,
      start,
      end,
      mins > 30 ? 'intentional' : 'break',
    );
  }

  // Events: pauses where Ana chose to wait, breaks, guard attempts. Feeds Today + Your week.
  const event = (type: string, payload: object, when: string) =>
    db.runAsync(
      'INSERT INTO events (id, type, payload, created_at) VALUES (?, ?, ?, ?)',
      id(),
      type,
      JSON.stringify(payload),
      when,
    );
  const dodged = [1, 2, 0, 3, 2, 4, 3]; // 6 days ago → today
  for (let i = 0; i < dodged.length; i++) {
    for (let n = 0; n < dodged[i]!; n++) {
      await event(
        'pause_decision',
        { kind: n % 2 ? 'borrow' : 'checkout', decision: 'save_for_later' },
        at(6 - i, 10 + n * 2),
      );
    }
  }
  await event('pause_decision', { kind: 'checkout', decision: 'continue' }, at(4, 18, 29));
  await event('break_taken', {}, at(0, 8, 30));
  await event('break_taken', {}, at(1, 23, 50));
  for (const h of [7, 12, 20])
    await event('block_shield_shown', { target: 'com.zhiliaoapp.musically' }, at(0, h));

  // Today's check-in: a stressful day, so Ginto keeps its tone gentle.
  await db.runAsync(
    'INSERT INTO checkins (id, stress, mood, fatigue, created_at) VALUES (?, 4, 2, 4, ?)',
    id(),
    at(0, 8, 0),
  );

  // Guards: TikTok at bedtime (strict), Shopee all day.
  await db.runAsync(
    `INSERT INTO block_rules (id, kind, target, label, mode, schedule_json, enabled, created_at)
     VALUES (?, 'app', 'com.zhiliaoapp.musically', 'TikTok', 'strict', ?, 1, ?)`,
    id(),
    JSON.stringify({ start: 22 * 60, end: 6 * 60 }),
    at(7),
  );
  await db.runAsync(
    `INSERT INTO block_rules (id, kind, target, label, mode, schedule_json, enabled, created_at)
     VALUES (?, 'site', 'shopee.ph', 'shopee.ph', 'pause', NULL, 1, ?)`,
    id(),
    at(7),
  );

  const s = useSettings.getState();
  s.setName('Ana');
  s.setBudget({
    monthlyIncome: toCentavos(22000),
    monthlyFixedBills: toCentavos(11500),
    savingsGoalMonthly: toCentavos(1500),
    payday: null,
  });
  s.setOnboarded(true);
  bumpData();
}
