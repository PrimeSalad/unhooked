// Affordability check. Always an *estimate*: the budget is self-reported and incomplete,
// and the UI must label it that way.

import type { Centavos } from './money';
import type { BudgetProfile } from './types';

export type AffordabilityVerdict = 'comfortable' | 'tight' | 'conflicts';

export interface AffordabilityInput {
  price: Centavos;
  budget: BudgetProfile;
  upcomingRepayments: Centavos; // still due this month
  spentThisMonth: Centavos; // purchases already marked bought this month
}

export interface AffordabilityResult {
  verdict: AffordabilityVerdict;
  available: Centavos; // income − bills − savings goal − already spent
  remainingAfter: Centavos; // available − price (may be negative)
  shortfall: Centavos; // how much the repayments would be short by (0 if none)
}

/** Below this share of `available` left over after repayments, a purchase is "tight". */
const TIGHT_BUFFER = 0.2;

export function checkAffordability(input: AffordabilityInput): AffordabilityResult {
  const { price, budget, upcomingRepayments, spentThisMonth } = input;
  const available =
    budget.monthlyIncome - budget.monthlyFixedBills - budget.savingsGoalMonthly - spentThisMonth;
  const remainingAfter = available - price;
  const shortfall = Math.max(0, upcomingRepayments - remainingAfter);

  let verdict: AffordabilityVerdict;
  if (shortfall > 0) verdict = 'conflicts';
  else if (remainingAfter - upcomingRepayments < Math.max(0, available) * TIGHT_BUFFER)
    verdict = 'tight';
  else verdict = 'comfortable';

  return { verdict, available, remainingAfter, shortfall };
}
