import { inferDailyPressure, inferPausePressure } from '../localDecisionModel';

const calmCheckIn = {
  id: 'c1',
  stress: 1 as const,
  mood: 5 as const,
  fatigue: 1 as const,
  createdAt: '2026-10-09T08:00:00.000Z',
};

describe('local decision model', () => {
  it('ranks a repayment conflict with high stress above a comfortable purchase', () => {
    const pressured = inferPausePressure({
      kind: 'checkout',
      facts: {
        price: 450000,
        verdict: 'conflicts',
        shortfall: 250000,
        dueThisMonth: 900000,
        owedTotal: 1800000,
        monthlyIncome: 2200000,
        monthlyFixedBills: 950000,
        savingsGoalMonthly: 150000,
      },
      latestCheckIn: { ...calmCheckIn, stress: 5, fatigue: 5, mood: 2 },
    });
    const comfortable = inferPausePressure({
      kind: 'checkout',
      facts: {
        price: 50000,
        verdict: 'comfortable',
        shortfall: 0,
        dueThisMonth: 0,
        owedTotal: 0,
        monthlyIncome: 2200000,
        monthlyFixedBills: 500000,
        savingsGoalMonthly: 100000,
      },
      latestCheckIn: calmCheckIn,
    });

    expect(pressured.band).toBe('high');
    expect(pressured.score).toBeGreaterThan(comfortable.score);
    expect(pressured.factors.map((factor) => factor.key)).toContain('affordability_conflict');
  });

  it('explains a scroll overrun without diagnosing the user', () => {
    const result = inferPausePressure({
      kind: 'scroll',
      facts: { scrollMinutes: 50, scrollLimit: 20 },
      latestCheckIn: null,
    });
    expect(result.factors[0]?.key).toBe('scroll_overrun');
    expect(result.recommendedAction).toMatch(/break/i);
    expect(result.summary).not.toMatch(/addict|diagnos/i);
  });

  it('stays useful when the user has not entered a budget or check-in', () => {
    const result = inferDailyPressure({
      monthlyIncome: 0,
      monthlyFixedBills: 0,
      savingsGoalMonthly: 0,
      owedTotal: 0,
      dueThisMonth: 0,
      scrollMinutesToday: 0,
      scrollLimitMinutes: 20,
      coolingCount: 0,
      checkIn: null,
    });
    expect(result.band).toBe('steady');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
