import { balances, dueBy, monthsToClear, orderDebts } from '../repayment';
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
});
