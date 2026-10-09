// Saves a log the user confirmed in Ask Ginto through the same repositories the Debt,
// Spend and Scroll screens use, so events, totals and insights stay consistent.

import type { SQLiteDatabase } from 'expo-sqlite';

import type { ChatLogEntry } from '@/domain/chatLog';

import { addDebt, addPayment, listDebts } from './debts';
import { addPurchase, setPurchaseStatus } from './purchases';
import { logBreak, logPastSession } from './repo';

/** Open debts the user owes, by lender name, for matching "nagbayad ako sa Tala". */
export async function openLenders(db: SQLiteDatabase): Promise<string[]> {
  return (await listDebts(db))
    .filter((b) => b.debt.direction === 'owed' && b.outstanding > 0)
    .map((b) => b.debt.counterparty);
}

export async function saveChatLog(db: SQLiteDatabase, entry: ChatLogEntry): Promise<void> {
  switch (entry.kind) {
    case 'spent': {
      const id = await addPurchase(db, { item: entry.item, price: entry.amount, isNeed: entry.isNeed });
      await setPurchaseStatus(db, id, 'bought');
      return;
    }
    case 'payment': {
      const debt = (await listDebts(db)).find(
        (b) =>
          b.debt.direction === 'owed' &&
          b.outstanding > 0 &&
          b.debt.counterparty.toLowerCase() === entry.lender.toLowerCase(),
      );
      if (!debt) throw new Error(`No open debt to ${entry.lender} was found.`);
      await addPayment(db, debt.debt.id, entry.amount);
      return;
    }
    case 'debt':
      await addDebt(db, {
        direction: entry.direction,
        counterparty: entry.lender,
        principal: entry.amount,
        dueDate: entry.dueDate,
        interestRatePct: null,
        notes: null,
      });
      return;
    case 'scroll':
      await logPastSession(db, entry.app, entry.minutes, new Date());
      return;
    case 'break':
      await logBreak(db);
  }
}
