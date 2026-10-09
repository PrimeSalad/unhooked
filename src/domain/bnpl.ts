// BNPL true-cost calculator (plan.md Phase 3). Pure function; the UI shows its output verbatim.

import type { Centavos } from './money';

export interface BnplInput {
  upfrontPrice: Centavos;
  installmentAmount: Centavos;
  numberOfPayments: number;
  fees: Centavos; // one-time processing / convenience fees
}

export interface BnplResult {
  totalRepayment: Centavos;
  extraCost: Centavos; // totalRepayment - upfrontPrice (can be 0)
  extraCostPct: number; // extraCost / upfrontPrice * 100, 1 decimal
}

export function calculateBnpl(_input: BnplInput): BnplResult {
  throw new Error('TODO(P3): implement calculateBnpl');
}
