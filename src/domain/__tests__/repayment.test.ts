import {
  balances,
  dueBy,
  endOfMonthDate,
  monthsToClear,
  orderDebts,
  planRepayment,
  politeReminder,
  repaymentReminderDate,
} from '../repayment';
import type { Debt, Payment } from '../types';

const debt = (over: Partial<Debt>): Debt => ({
  id: 'd',
  direction: 'owed',
  counterparty: 'X',
  principal: 100000,
  interestRatePct: null,
  dueDate: null,
  terms: null,
  notes: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  closedAt: null,
  ...over,
});

const pay = (debtId: string, amount: number): Payment => ({
  id: `${debtId}-${amount}`,
  debtId,
  amount,
  paidAt: '2026-10-02T00:00:00.000Z',
  note: null,
});

describe('repayment', () => {
  it('balances subtracts partial payments and never goes below 0', () => {
    const [a, b] = balances(
      [debt({ id: 'a' }), debt({ id: 'b', principal: 5000 })],
      [pay('a', 25000), pay('b', 9000)],
    );
    expect(a).toMatchObject({ paid: 25000, outstanding: 75000, progress: 0.25 });
    expect(b).toMatchObject({ outstanding: 0, progress: 1 });
  });

  it('uses the local calendar for month-end, including the final day', () => {
    expect(endOfMonthDate(new Date(2026, 9, 9))).toBe('2026-10-31');
  });

  it('avalanche orders by interest desc; snowball by outstanding asc', () => {
    const list = balances(
      [
        debt({ id: 'low', interestRatePct: 2, principal: 50000 }),
        debt({ id: 'high', interestRatePct: 15, principal: 300000 }),
      ],
      [],
    );
    expect(orderDebts(list, 'avalanche').map((b) => b.debt.id)).toEqual(['high', 'low']);
    expect(orderDebts(list, 'snowball').map((b) => b.debt.id)).toEqual(['low', 'high']);
  });

  it('dueBy only counts money I owe with a due date in range', () => {
    const list = balances(
      [
        debt({ id: 'soon', dueDate: '2026-10-15' }),
        debt({ id: 'later', dueDate: '2026-11-20' }),
        debt({ id: 'lent', direction: 'lent', dueDate: '2026-10-10' }),
        debt({ id: 'undated' }),
      ],
      [],
    );
    expect(dueBy(list, '2026-10-31')).toBe(100000);
  });

  it('monthsToClear is null when the budget is 0', () => {
    const list = balances([debt({})], []);
    expect(monthsToClear(list, 0)).toBeNull();
    expect(monthsToClear(list, 30000)).toBe(4);
  });

  it('plans only debts I owe and warns when this month is unaffordable', () => {
    const list = balances(
      [
        debt({ id: 'soon', principal: 80000, dueDate: '2026-10-15' }),
        debt({ id: 'later', principal: 40000, dueDate: '2026-12-01' }),
        debt({ id: 'lent', direction: 'lent', principal: 20000 }),
      ],
      [],
    );
    const plan = planRepayment(list, 50000, 'due_date', new Date(2026, 9, 9));
    expect(plan.ordered.map((item) => item.debt.id)).toEqual(['soon', 'later']);
    expect(plan.totalOutstanding).toBe(120000);
    expect(plan.dueThisMonth).toBe(80000);
    expect(plan.months).toBe(3);
    expect(plan.firstMonth).toEqual([{ debtId: 'soon', amount: 50000 }]);
    expect(plan.warning).toContain('more than this monthly amount');
  });

  it('keeps the reminder gentle and does not promise a repayment date', () => {
    expect(politeReminder(' Bea ', 45000)).toContain('Hi Bea,');
    expect(politeReminder('Bea', 45000)).toContain('₱450');
    expect(politeReminder('Bea', 45000)).not.toMatch(/must|immediately|guarantee/i);
  });

  it('warns when a later due date may exceed the monthly plan', () => {
    const list = balances([debt({ id: 'later', principal: 150000, dueDate: '2026-11-15' })], []);
    const plan = planRepayment(list, 50000, 'due_date', new Date(2026, 9, 9));
    expect(plan.warning).toContain('2026-11-15');
  });

  it('schedules a local reminder the day before, but not for past or invalid dates', () => {
    const now = new Date(2026, 9, 9, 8);
    expect(repaymentReminderDate('2026-10-15', now)).toEqual(new Date(2026, 9, 14, 9));
    expect(repaymentReminderDate('2026-10-09', now)).toBeNull();
    expect(repaymentReminderDate('2026-02-30', now)).toBeNull();
  });
});
