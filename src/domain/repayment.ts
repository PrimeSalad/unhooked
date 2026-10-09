// Debt balances + repayment ordering.

import type { Centavos } from './money';
import type { Debt, Payment } from './types';

export type RepaymentStrategy = 'due_date' | 'avalanche' | 'snowball';

export interface DebtBalance {
  debt: Debt;
  paid: Centavos;
  outstanding: Centavos;
  progress: number; // 0–1 share already paid
}

export function balances(debts: Debt[], payments: Payment[]): DebtBalance[] {
  const paidBy = new Map<string, number>();
  for (const p of payments) paidBy.set(p.debtId, (paidBy.get(p.debtId) ?? 0) + p.amount);
  return debts.map((debt) => {
    const paid = paidBy.get(debt.id) ?? 0;
    const outstanding = Math.max(0, debt.principal - paid);
    const progress = debt.principal > 0 ? Math.min(1, paid / debt.principal) : 1;
    return { debt, paid, outstanding, progress };
  });
}

const byDue = (a: DebtBalance, b: DebtBalance) =>
  (a.debt.dueDate ?? '9999').localeCompare(b.debt.dueDate ?? '9999');

export function orderDebts(list: DebtBalance[], strategy: RepaymentStrategy): DebtBalance[] {
  const open = list.filter((b) => b.outstanding > 0);
  switch (strategy) {
    case 'avalanche':
      return [...open].sort(
        (a, b) => (b.debt.interestRatePct ?? 0) - (a.debt.interestRatePct ?? 0) || byDue(a, b),
      );
    case 'snowball':
      return [...open].sort((a, b) => a.outstanding - b.outstanding || byDue(a, b));
    default:
      return [...open].sort(byDue);
  }
}

/** Sum still owed on `owed` debts due on or before `untilIso` (undated debts excluded). */
export function dueBy(list: DebtBalance[], untilIso: string): Centavos {
  return list
    .filter((b) => b.debt.direction === 'owed' && b.debt.dueDate && b.debt.dueDate <= untilIso)
    .reduce((sum, b) => sum + b.outstanding, 0);
}

/** Months to clear everything at `monthlyBudget`, or null if the budget is 0. */
export function monthsToClear(list: DebtBalance[], monthlyBudget: Centavos): number | null {
  const total = list
    .filter((b) => b.debt.direction === 'owed')
    .reduce((s, b) => s + b.outstanding, 0);
  if (total === 0) return 0;
  if (monthlyBudget <= 0) return null;
  return Math.ceil(total / monthlyBudget);
}
