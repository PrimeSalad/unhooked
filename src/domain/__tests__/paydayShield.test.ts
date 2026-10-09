import { isLateNight, isShoppingApp, shieldMoney } from '../paydayShield';

describe('paydayShield', () => {
  it('spots shopping apps by package or label', () => {
    expect(isShoppingApp('com.shopee.ph')).toBe(true);
    expect(isShoppingApp(undefined, 'Lazada')).toBe(true);
    expect(isShoppingApp('com.facebook.katana', 'Facebook')).toBe(false);
  });

  it('late night is 10 PM to 4 AM', () => {
    expect(isLateNight(new Date(2026, 9, 9, 23, 48))).toBe(true);
    expect(isLateNight(new Date(2026, 9, 9, 3, 0))).toBe(true);
    expect(isLateNight(new Date(2026, 9, 9, 14, 0))).toBe(false);
  });

  it('splits what is left until payday', () => {
    const m = shieldMoney(
      {
        monthlyIncome: 2000000,
        monthlyFixedBills: 800000,
        savingsGoalMonthly: 200000,
        payday: '15_30',
      },
      300000,
      400000,
      new Date(2026, 9, 9),
    );
    expect(m.free).toBe(300000);
    expect(m.days).toBe(6);
    expect(m.perDay).toBe(50000);
  });
});
