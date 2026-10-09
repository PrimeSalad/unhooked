// Pure inputs for the pause. Screens load records; this module computes and labels
// the facts that the local reflection provider is allowed to phrase.

import { checkAffordability } from './affordability';
import { formatPHP } from './money';
import type { BudgetProfile, PlannedPurchase, WellnessCheckIn } from './types';

export interface PauseFactResult {
  title: string;
  item: string;
  facts: Record<string, string | number>;
  checkIn: WellnessCheckIn | null;
}

interface SharedInput {
  nextDueLabel: string;
  checkIn: WellnessCheckIn | null;
}

const positiveCentavos = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

export function borrowPauseFacts(
  input: SharedInput & { amount: number; owedTotal: number; dueThisMonth: number },
): PauseFactResult {
  const amount = positiveCentavos(input.amount) ? input.amount : null;
  return {
    title: amount === null ? 'Before you borrow' : `Before you borrow ${formatPHP(amount)}`,
    item: '',
    facts: {
      ...(amount === null ? {} : { amount }),
      ...(positiveCentavos(input.owedTotal) ? { owedTotal: input.owedTotal } : {}),
      ...(positiveCentavos(input.dueThisMonth) ? { dueThisMonth: input.dueThisMonth } : {}),
      ...(input.nextDueLabel ? { nextDueLabel: input.nextDueLabel } : {}),
    },
    checkIn: input.checkIn,
  };
}

export function checkoutPauseFacts(
  input: SharedInput & {
    purchase: Pick<PlannedPurchase, 'item' | 'price'> | null;
    budget: BudgetProfile | null;
    dueThisMonth: number;
    spentThisMonth: number;
  },
): PauseFactResult {
  const price = input.purchase?.price;
  const hasPrice = positiveCentavos(price);
  const estimate =
    hasPrice && input.budget
      ? checkAffordability({
          price,
          budget: input.budget,
          upcomingRepayments: input.dueThisMonth,
          spentThisMonth: input.spentThisMonth,
        })
      : null;
  return {
    title: input.purchase ? `Before you buy ${input.purchase.item}` : 'Before you buy',
    item: input.purchase?.item ?? '',
    facts: {
      ...(hasPrice ? { price } : {}),
      hasBudget: input.budget ? 1 : 0,
      ...(estimate
        ? {
            verdict: estimate.verdict,
            remainingAfter: estimate.remainingAfter,
            shortfall: estimate.shortfall,
          }
        : {}),
      ...(input.nextDueLabel ? { nextDueLabel: input.nextDueLabel } : {}),
    },
    checkIn: input.checkIn,
  };
}

export function scrollPauseFacts(
  input: SharedInput & { app: string; minutes: number },
): PauseFactResult {
  const app = input.app.trim() || 'your feed';
  return {
    title: `You have been on ${app}`,
    item: app,
    facts: {
      app,
      ...(Number.isSafeInteger(input.minutes) && input.minutes > 0
        ? { minutes: input.minutes }
        : {}),
    },
    checkIn: input.checkIn,
  };
}
