// Debt summary + repayment planner (plan.md Phase 2).

import type { Centavos } from './money';
import type { Debt, Payment } from './types';

export type RepaymentStrategy = 'due_date' | 'avalanche' | 'snowball';

export interface DebtBalance {
  debt: Debt;
  paid: Centavos;
  outstanding: Centavos;
}

export interface RepaymentPlan {
  order: DebtBalance[];
  monthsToClear: number | null; // null = budget too small to ever clear
  isRealistic: boolean;
  warning: string | null;
}

export function balances(_debts: Debt[], _payments: Payment[]): DebtBalance[] {
  throw new Error('TODO(P2): implement balances');
}

export function planRepayment(
  _balances: DebtBalance[],
  _monthlyBudget: Centavos,
  _strategy: RepaymentStrategy,
): RepaymentPlan {
  throw new Error('TODO(P2): implement planRepayment');
}
