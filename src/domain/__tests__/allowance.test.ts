import { dailyAllowance, daysUntil, nextPayday } from '../allowance';

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe('allowance', () => {
  it('twice monthly: 15th, then 30th, then next 15th', () => {
    expect(nextPayday('15_30', d(2026, 10, 9))).toEqual(d(2026, 10, 15));
    expect(nextPayday('15_30', d(2026, 10, 15))).toEqual(d(2026, 10, 30));
    expect(nextPayday('15_30', d(2026, 10, 30))).toEqual(d(2026, 11, 15));
  });

  it('twice monthly in February uses the last day', () => {
    expect(nextPayday('15_30', d(2026, 2, 20))).toEqual(d(2026, 2, 28));
  });

  it('monthly day and month-end fallback', () => {
    expect(nextPayday(25, d(2026, 10, 9))).toEqual(d(2026, 10, 25));
    expect(nextPayday(25, d(2026, 10, 26))).toEqual(d(2026, 11, 25));
    expect(nextPayday(null, d(2026, 10, 9))).toEqual(d(2026, 10, 31));
  });

  it('splits free money per day and never goes negative', () => {
    expect(daysUntil(d(2026, 10, 15), d(2026, 10, 9))).toBe(6);
    expect(dailyAllowance(600000, 6)).toBe(100000);
    expect(dailyAllowance(-500, 6)).toBe(0);
  });
});
