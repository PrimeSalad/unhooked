import type { BudgetProfile } from './types';

export type MonthlyPositionBand = 'missing' | 'clear' | 'tight' | 'short';

export interface MonthlyPosition {
  income: number;
  essentials: number;
  repayments: number;
  spent: number;
  availableBeforeRepayments: number;
  safeToSpend: number;
  repaymentGap: number;
  repaymentCoverage: number;
  band: MonthlyPositionBand;
}

/**
 * One auditable monthly position shared by Debt and Spend.
 * Values are centavos; negative user inputs are treated as zero.
 */
export function getMonthlyPosition(input: {
  budget: BudgetProfile | null;
  repayments: number;
  spent: number;
}): MonthlyPosition {
  const income = Math.max(0, input.budget?.monthlyIncome ?? 0);
  const essentials = Math.max(
    0,
    (input.budget?.monthlyFixedBills ?? 0) + (input.budget?.savingsGoalMonthly ?? 0),
  );
  const repayments = Math.max(0, input.repayments);
  const spent = Math.max(0, input.spent);
  const availableBeforeRepayments = income - essentials - spent;
  const afterRepayments = availableBeforeRepayments - repayments;
  const safeToSpend = Math.max(0, afterRepayments);
  const repaymentGap = Math.max(0, -afterRepayments);
  const repaymentCoverage =
    repayments === 0 ? 1 : Math.max(0, availableBeforeRepayments) / repayments;

  const band: MonthlyPositionBand = !input.budget
    ? 'missing'
    : repaymentGap > 0
      ? 'short'
      : safeToSpend <= income * 0.08 && repayments > 0
        ? 'tight'
        : 'clear';

  return {
    income,
    essentials,
    repayments,
    spent,
    availableBeforeRepayments,
    safeToSpend,
    repaymentGap,
    repaymentCoverage,
    band,
  };
}
