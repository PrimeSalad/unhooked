// Affordability check (plan.md Phase 3). Always returns an *estimate* — the user's data is
// self-reported and incomplete, and the UI must label it that way.

import type { Centavos } from './money';
import type { BudgetProfile } from './types';

export type AffordabilityVerdict = 'comfortable' | 'tight' | 'conflicts';

export interface AffordabilityInput {
  price: Centavos;
  budget: BudgetProfile;
  upcomingRepayments: Centavos; // due before next payday
  spentThisMonth: Centavos;
}

export interface AffordabilityResult {
  verdict: AffordabilityVerdict;
  remainingAfter: Centavos; // may be negative
  conflicts: string[]; // e.g. "₱3,000 repayment due on Oct 15"
}

export function checkAffordability(_input: AffordabilityInput): AffordabilityResult {
  throw new Error('TODO(P3): implement checkAffordability');
}
