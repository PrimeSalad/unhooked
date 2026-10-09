// Debt records and payments. Balances are always derived from recorded payments.

import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { Centavos } from '@/domain/money';
import { balances, type DebtBalance } from '@/domain/repayment';
import type { Debt, DebtDirection, Payment } from '@/domain/types';
import { cancelReminder, debtReminderId, scheduleDebtReminder } from '@/lib/notifications';

import { logEvent } from './events';
import { bumpData } from './useDbQuery';

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

const toDebt = (row: DebtRow): Debt => ({
  id: row.id,
  direction: row.direction,
  counterparty: row.counterparty,
  principal: row.principal,
  interestRatePct: row.interest_rate_pct,
  dueDate: row.due_date,
  terms: row.terms,
  notes: row.notes,
  createdAt: row.created_at,
  closedAt: row.closed_at,
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
  const payments: Payment[] = pays.map((payment) => ({
    id: payment.id,
    debtId: payment.debt_id,
    amount: payment.amount,
    paidAt: payment.paid_at,
    note: payment.note,
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

export async function addDebt(db: SQLiteDatabase, debt: NewDebt): Promise<void> {
  if (!Number.isSafeInteger(debt.principal) || debt.principal <= 0)
    throw new Error('Invalid debt amount');
  const id = Crypto.randomUUID();
  await db.runAsync(
    `INSERT INTO debts (id, direction, counterparty, principal, interest_rate_pct, due_date, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    debt.direction,
    debt.counterparty.trim(),
    debt.principal,
    debt.interestRatePct,
    debt.dueDate,
    debt.notes,
    new Date().toISOString(),
  );
  await logEvent(db, 'debt_added', { direction: debt.direction });
  bumpData();
  if (debt.direction === 'owed' && debt.dueDate) await scheduleDebtReminder(id, debt.dueDate);
}

export async function closeDebt(db: SQLiteDatabase, debtId: string): Promise<void> {
  const balance = (await listDebts(db)).find((item) => item.debt.id === debtId);
  if (!balance || balance.outstanding > 0)
    throw new Error('Record still has an outstanding balance');
  await db.runAsync(
    'UPDATE debts SET closed_at = ? WHERE id = ?',
    new Date().toISOString(),
    debtId,
  );
  await cancelReminder(debtReminderId(debtId));
  bumpData();
}

export async function addPayment(
  db: SQLiteDatabase,
  debtId: string,
  amount: Centavos,
): Promise<void> {
  const balance = (await listDebts(db)).find((item) => item.debt.id === debtId);
  if (!balance || !Number.isSafeInteger(amount) || amount <= 0 || amount > balance.outstanding)
    throw new Error('Payment must be within the remaining balance');
  await db.runAsync(
    'INSERT INTO payments (id, debt_id, amount, paid_at) VALUES (?, ?, ?, ?)',
    Crypto.randomUUID(),
    debtId,
    amount,
    new Date().toISOString(),
  );
  await logEvent(db, 'payment_recorded', { amount });
  if (amount === balance.outstanding) await closeDebt(db, debtId);
  else bumpData();
}

export async function deleteDebt(db: SQLiteDatabase, debtId: string): Promise<void> {
  await db.runAsync('DELETE FROM debts WHERE id = ?', debtId);
  await cancelReminder(debtReminderId(debtId));
  bumpData();
}
