import { lenderCheck, scanLoanText } from '../utangScan';

const today = new Date(2026, 9, 9);

describe('utangScan', () => {
  it('reads a loan app screen', () => {
    const s = scanLoanText(
      'Pera Agad\nLoan amount: ₱2,500.00\nTotal amount due: ₱3,000.00\nDue date: Oct 15, 2026\nSEC Reg. No. CS201912345 Certificate of Authority No. 3051',
      today,
    );
    expect(s.lender).toBe('Pera Agad');
    expect(s.amount).toBe(300000);
    expect(s.dueDate).toBe('2026-10-15');
    expect(s.secReg).toBe('CS201912345');
    expect(s.caNumber).toBe('3051');
    expect(lenderCheck(s)).toBe('both');
  });

  it('handles slashes, no year and missing registration', () => {
    const s = scanLoanText('Pay PHP 1,200 on or before 10/20/2026', today);
    expect(s.amount).toBe(120000);
    expect(s.dueDate).toBe('2026-10-20');
    expect(lenderCheck(s)).toBe('none');
    expect(scanLoanText('due 2 Nov', today).dueDate).toBe('2026-11-02');
  });

  it('flags threats in the same text', () => {
    const s = scanLoanText('Magbayad ka na or we will contact your family and employer', today);
    expect(s.risk.level).not.toBe('low');
  });
});
