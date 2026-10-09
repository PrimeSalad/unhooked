// BNPL true-cost calculator. Pure function; the UI shows its output verbatim.

import type { Centavos } from './money';

export interface BnplInput {
  upfrontPrice: Centavos;
  installmentAmount: Centavos;
  numberOfPayments: number;
  fees: Centavos; // one-time processing / convenience fees
}

export interface BnplResult {
  totalRepayment: Centavos;
  extraCost: Centavos; // totalRepayment - upfrontPrice, never below 0
  extraCostPct: number; // extraCost / upfrontPrice * 100, 1 decimal
}

export function calculateBnpl(input: BnplInput): BnplResult | null {
  const { upfrontPrice, installmentAmount, numberOfPayments, fees } = input;
  if (!Number.isSafeInteger(numberOfPayments) || numberOfPayments <= 0) return null;
  if (![upfrontPrice, installmentAmount, fees].every(Number.isSafeInteger)) return null;
  if (upfrontPrice <= 0 || installmentAmount <= 0 || fees < 0) return null;
  const totalRepayment = installmentAmount * numberOfPayments + fees;
  if (!Number.isSafeInteger(totalRepayment)) return null;
  const extraCost = Math.max(0, totalRepayment - upfrontPrice);
  const extraCostPct = Math.round((extraCost / upfrontPrice) * 1000) / 10;
  return { totalRepayment, extraCost, extraCostPct };
}
