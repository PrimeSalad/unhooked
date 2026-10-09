// Debt balances + repayment ordering.

import type { Centavos } from './money';
import { formatPHP } from './money';
import type { Debt, Payment } from './types';

export type RepaymentStrategy = 'due_date' | 'avalanche' | 'snowball';

export function endOfMonthDate(from = new Date()): string {
  const lastDay = new Date(from.getFullYear(), from.getMonth() + 1, 0);
  return `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
}

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
    .filter(
      (b) =>
        b.debt.direction === 'owed' &&
        b.debt.dueDate &&
        b.debt.dueDate.slice(0, 10) <= untilIso.slice(0, 10),
    )
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

export interface RepaymentPlan {
  ordered: DebtBalance[];
  totalOutstanding: Centavos;
  dueThisMonth: Centavos;
  months: number | null;
  firstMonth: { debtId: string; amount: Centavos }[];
  warning: string | null;
}

/** A simple allocation estimate, not a promise: interest and future fees are excluded. */
export function planRepayment(
  list: DebtBalance[],
  monthlyBudget: Centavos,
  strategy: RepaymentStrategy,
  today = new Date(),
): RepaymentPlan {
  const ordered = orderDebts(
    list.filter((balance) => balance.debt.direction === 'owed'),
    strategy,
  );
  const totalOutstanding = ordered.reduce((sum, balance) => sum + balance.outstanding, 0);
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const monthEnd = endOfMonthDate(today);
  const dueThisMonth = dueBy(ordered, monthEnd);
  const budget = Number.isSafeInteger(monthlyBudget) ? Math.max(0, monthlyBudget) : 0;
  const firstUnfundedDue = ordered
    .filter((balance) => balance.debt.dueDate)
    .sort(byDue)
    .find((balance) => {
      const due = balance.debt.dueDate?.slice(0, 10);
      if (!due) return false;
      if (due < todayKey) return true;
      const [year, month] = due.split('-').map(Number);
      if (!year || !month) return false;
      const monthsAvailable = Math.max(
        0,
        (year - today.getFullYear()) * 12 + month - (today.getMonth() + 1) + 1,
      );
      return dueBy(ordered, due) > monthsAvailable * budget;
    });
  let remaining = budget;
  const firstMonth = ordered
    .map((balance) => {
      const amount = Math.min(remaining, balance.outstanding);
      remaining -= amount;
      return { debtId: balance.debt.id, amount };
    })
    .filter((entry) => entry.amount > 0);
  const warning =
    totalOutstanding === 0
      ? null
      : budget === 0
        ? 'Add a monthly amount to see a plan.'
        : dueThisMonth > budget
          ? `${formatPHP(dueThisMonth)} is due by month-end, more than this monthly amount. Check dates and consider asking for a payment arrangement.`
          : firstUnfundedDue
            ? `The amounts due by ${firstUnfundedDue.debt.dueDate?.slice(0, 10)} may exceed this monthly plan. Check your dates and consider asking for a payment arrangement.`
            : 'This estimate excludes future interest and fees. Check each lender’s actual due dates.';

  return {
    ordered,
    totalOutstanding,
    dueThisMonth,
    months: monthsToClear(ordered, budget),
    firstMonth,
    warning,
  };
}

/** User-editable starting point; sharing is always initiated by the user. */
export function politeReminder(name: string, outstanding: Centavos): string {
  const greeting = name.trim() ? `Hi ${name.trim()},` : 'Hi,';
  return `${greeting} hope you're doing well. Just checking in about the ${formatPHP(outstanding)} still outstanding. Please let me know when a good time to settle it might be. Thank you.`;
}

/** 9 AM local time on the day before an ISO calendar due date. */
export function repaymentReminderDate(dueDate: string, now = new Date()): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dueDate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const due = new Date(year, month - 1, day);
  if (due.getFullYear() !== year || due.getMonth() !== month - 1 || due.getDate() !== day)
    return null;
  const reminder = new Date(year, month - 1, day - 1, 9);
  return reminder.getTime() > now.getTime() ? reminder : null;
}
