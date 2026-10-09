import { borrowPauseFacts, checkoutPauseFacts, scrollPauseFacts } from '../pauseFacts';
import { toCentavos } from '../money';
import type { BudgetProfile, WellnessCheckIn } from '../types';

const budget: BudgetProfile = {
  monthlyIncome: toCentavos(22000),
  monthlyFixedBills: toCentavos(12000),
  savingsGoalMonthly: toCentavos(1000),
  payday: null,
};

const checkIn: WellnessCheckIn = {
  id: 'checkin-1',
  stress: 4,
  fatigue: 2,
  mood: 3,
  createdAt: '2026-10-09T00:00:00.000Z',
};

describe('pause facts from records', () => {
  it('uses the saved purchase and budget to compute checkout estimates', () => {
    const result = checkoutPauseFacts({
      purchase: { item: 'Headphones', price: toCentavos(4500) },
      budget,
      dueThisMonth: toCentavos(6000),
      spentThisMonth: 0,
      nextDueLabel: 'Loan A: ₱6,000 due soon.',
      checkIn,
    });

    expect(result.title).toBe('Before you buy Headphones');
    expect(result.facts).toMatchObject({
      price: toCentavos(4500),
      hasBudget: 1,
      verdict: 'conflicts',
      remainingAfter: toCentavos(4500),
      shortfall: toCentavos(1500),
      nextDueLabel: 'Loan A: ₱6,000 due soon.',
    });
    expect(result.checkIn).toBe(checkIn);
  });

  it('does not invent a zero-price purchase or budget estimate when a record is missing', () => {
    const result = checkoutPauseFacts({
      purchase: null,
      budget,
      dueThisMonth: 0,
      spentThisMonth: 0,
      nextDueLabel: '',
      checkIn: null,
    });

    expect(result.title).toBe('Before you buy');
    expect(result.facts).toEqual({ hasBudget: 1 });
  });

  it('keeps the proposed loan separate from recorded repayments', () => {
    const result = borrowPauseFacts({
      amount: toCentavos(2000),
      owedTotal: toCentavos(7500),
      dueThisMonth: toCentavos(3000),
      spentThisMonth: 0,
      budget,
      nextDueLabel: '',
      checkIn: null,
    });

    expect(result.facts).toEqual({
      amount: toCentavos(2000),
      owedTotal: toCentavos(7500),
      dueThisMonth: toCentavos(3000),
      remainingBudget: toCentavos(6000),
    });
    expect(result.facts).not.toHaveProperty('projectedDue');
  });

  it('uses only a valid session duration for the scroll reflection', () => {
    const valid = scrollPauseFacts({
      app: 'TikTok',
      minutes: 37,
      nextDueLabel: '',
      checkIn: null,
    });
    const invalid = scrollPauseFacts({
      app: ' ',
      minutes: Number.NaN,
      nextDueLabel: '',
      checkIn: null,
    });

    expect(valid.facts).toEqual({ app: 'TikTok', minutes: 37 });
    expect(invalid.facts).toEqual({ app: 'your feed' });
  });
});
