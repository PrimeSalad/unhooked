import { calculateBnpl } from '../bnpl';
import { toCentavos } from '../money';

describe('calculateBnpl', () => {
  it('total = installment × payments + fees', () => {
    const r = calculateBnpl({
      upfrontPrice: toCentavos(4500),
      installmentAmount: toCentavos(899),
      numberOfPayments: 6,
      fees: toCentavos(150),
    });
    expect(r?.totalRepayment).toBe(toCentavos(5544));
    expect(r?.extraCost).toBe(toCentavos(1044));
    expect(r?.extraCostPct).toBe(23.2);
  });

  it('extraCost is 0 when installments equal the upfront price and there are no fees', () => {
    const r = calculateBnpl({
      upfrontPrice: toCentavos(3000),
      installmentAmount: toCentavos(1000),
      numberOfPayments: 3,
      fees: 0,
    });
    expect(r).toEqual({ totalRepayment: toCentavos(3000), extraCost: 0, extraCostPct: 0 });
  });

  it('rejects zero, negative or fractional numberOfPayments', () => {
    const base = { upfrontPrice: 100, installmentAmount: 50, fees: 0 };
    expect(calculateBnpl({ ...base, numberOfPayments: 0 })).toBeNull();
    expect(calculateBnpl({ ...base, numberOfPayments: -2 })).toBeNull();
    expect(calculateBnpl({ ...base, numberOfPayments: 1.5 })).toBeNull();
  });

  it('rejects amounts that overflow integer centavos', () => {
    expect(
      calculateBnpl({
        upfrontPrice: 100,
        installmentAmount: Number.MAX_SAFE_INTEGER,
        numberOfPayments: 2,
        fees: 0,
      }),
    ).toBeNull();
  });
});
