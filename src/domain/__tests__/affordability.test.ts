import { checkAffordability } from '../affordability';
import { toCentavos } from '../money';
import type { BudgetProfile } from '../types';

const budget: BudgetProfile = {
  monthlyIncome: toCentavos(22000),
  monthlyFixedBills: toCentavos(12000),
  savingsGoalMonthly: toCentavos(1000),
  payday: null,
};

describe('checkAffordability', () => {
  it('conflicts when the purchase leaves less than the upcoming repayments', () => {
    // available 9,000 − 4,500 = 4,500 left; repayments 6,000 → 1,500 short
    const r = checkAffordability({
      price: toCentavos(4500),
      budget,
      upcomingRepayments: toCentavos(6000),
      spentThisMonth: 0,
    });
    expect(r.verdict).toBe('conflicts');
    expect(r.remainingAfter).toBe(toCentavos(4500));
    expect(r.shortfall).toBe(toCentavos(1500));
  });

  it('tight when repayments are covered but little is left', () => {
    const r = checkAffordability({
      price: toCentavos(4500),
      budget,
      upcomingRepayments: toCentavos(3000),
      spentThisMonth: 0,
    });
    expect(r.verdict).toBe('tight'); // 1,500 left after repayments < 20% of 9,000
    expect(r.shortfall).toBe(0);
  });

  it('comfortable when plenty is left after repayments', () => {
    const r = checkAffordability({
      price: toCentavos(500),
      budget,
      upcomingRepayments: toCentavos(1000),
      spentThisMonth: 0,
    });
    expect(r.verdict).toBe('comfortable');
  });

  it('counts what was already spent this month', () => {
    const r = checkAffordability({
      price: toCentavos(500),
      budget,
      upcomingRepayments: 0,
      spentThisMonth: toCentavos(8800),
    });
    expect(r.available).toBe(toCentavos(200));
    expect(r.remainingAfter).toBe(toCentavos(-300));
    // Going over what is available counts as a conflict even with no repayments due.
    expect(r.verdict).toBe('conflicts');
    expect(r.shortfall).toBe(toCentavos(300));
  });
});
