// Purchase records and 24-hour cooling. Status changes are the single place
// that schedules or cancels each purchase's discreet local reminder.

import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { Centavos } from '@/domain/money';
import { isValidPlannedDate } from '@/domain/purchases';
import type { PlannedPurchase, PurchaseStatus } from '@/domain/types';
import { cancelReminder, coolingReminderId, scheduleCoolingReminder } from '@/lib/notifications';

import { logEvent } from './events';
import { bumpData } from './useDbQuery';

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

const toPurchase = (row: PurchaseRow): PlannedPurchase => ({
  id: row.id,
  item: row.item,
  price: row.price,
  isNeed: row.is_need === 1,
  plannedDate: row.planned_date,
  alternativePrice: row.alternative_price,
  status: row.status,
  coolingUntil: row.cooling_until,
  createdAt: row.created_at,
});

export async function listPurchases(db: SQLiteDatabase): Promise<PlannedPurchase[]> {
  const rows = await db.getAllAsync<PurchaseRow>(
    'SELECT * FROM purchases ORDER BY created_at DESC LIMIT 100',
  );
  return rows.map(toPurchase);
}

export async function getPurchase(db: SQLiteDatabase, id: string): Promise<PlannedPurchase | null> {
  const row = await db.getFirstAsync<PurchaseRow>('SELECT * FROM purchases WHERE id = ?', id);
  return row ? toPurchase(row) : null;
}

export interface NewPurchase {
  item: string;
  price: Centavos;
  isNeed: boolean;
  plannedDate?: string | null;
  alternativePrice?: Centavos | null;
}

export async function addPurchase(db: SQLiteDatabase, purchase: NewPurchase): Promise<string> {
  if (!purchase.item.trim() || !Number.isSafeInteger(purchase.price) || purchase.price <= 0)
    throw new Error('Enter an item and a valid price.');
  if (
    purchase.alternativePrice != null &&
    (!Number.isSafeInteger(purchase.alternativePrice) || purchase.alternativePrice <= 0)
  )
    throw new Error('Enter a valid cheaper-option price.');
  if (purchase.alternativePrice != null && purchase.alternativePrice >= purchase.price)
    throw new Error('The cheaper option must cost less than this item.');
  if (purchase.plannedDate && !isValidPlannedDate(purchase.plannedDate))
    throw new Error('Enter a valid planned date today or later.');
  const id = Crypto.randomUUID();
  await db.runAsync(
    `INSERT INTO purchases
      (id, item, price, is_need, planned_date, alternative_price, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'planned', ?)`,
    id,
    purchase.item.trim(),
    purchase.price,
    purchase.isNeed ? 1 : 0,
    purchase.plannedDate ?? null,
    purchase.alternativePrice ?? null,
    new Date().toISOString(),
  );
  await logEvent(db, 'purchase_evaluated', { price: purchase.price, isNeed: purchase.isNeed });
  bumpData();
  return id;
}

export async function setPurchaseStatus(
  db: SQLiteDatabase,
  id: string,
  status: PurchaseStatus,
): Promise<string | null> {
  const current = await getPurchase(db, id);
  if (!current) throw new Error('Purchase not found.');
  const at = new Date();
  const until =
    status === 'cooling' ? new Date(at.getTime() + 24 * 3600 * 1000).toISOString() : null;
  await db.runAsync(
    'UPDATE purchases SET status = ?, cooling_until = ?, bought_at = ? WHERE id = ?',
    status,
    until,
    status === 'bought' ? at.toISOString() : null,
    id,
  );
  if (status === 'cooling') {
    await logEvent(db, 'purchase_saved_for_later', { id });
    await cancelReminder(coolingReminderId(id));
    await scheduleCoolingReminder(id, until!);
  } else {
    await cancelReminder(coolingReminderId(id));
  }
  bumpData();
  return until;
}

export async function spentThisMonth(db: SQLiteDatabase): Promise<Centavos> {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString();
  const row = await db.getFirstAsync<{ total: number | null }>(
    "SELECT SUM(price) AS total FROM purchases WHERE status = 'bought' AND bought_at >= ? AND bought_at < ?",
    start,
    end,
  );
  return row?.total ?? 0;
}
