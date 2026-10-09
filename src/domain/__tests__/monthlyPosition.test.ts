import { getMonthlyPosition } from '../monthlyPosition';
import { toCentavos } from '../money';

const budget = {
  monthlyIncome: toCentavos(22000),
  monthlyFixedBills: toCentavos(9500),
  savingsGoalMonthly: toCentavos(1500),
  payday: null,
};

describe('monthly position', () => {
  it('reserves essentials, spending and repayments before calling money safe to spend', () => {
    expect(
      getMonthlyPosition({
        budget,
        repayments: toCentavos(5500),
        spent: toCentavos(1000),
      }),
    ).toMatchObject({
      availableBeforeRepayments: toCentavos(10000),
      safeToSpend: toCentavos(4500),
      repaymentGap: 0,
      band: 'clear',
    });
  });

  it('reports a repayment gap instead of showing a negative spend allowance', () => {
    expect(
      getMonthlyPosition({
        budget,
        repayments: toCentavos(12000),
        spent: toCentavos(2000),
      }),
    ).toMatchObject({
      safeToSpend: 0,
      repaymentGap: toCentavos(3000),
      band: 'short',
    });
  });

  it('does not pretend to know the position without a budget', () => {
    expect(getMonthlyPosition({ budget: null, repayments: 500000, spent: 0 }).band).toBe('missing');
  });
});
