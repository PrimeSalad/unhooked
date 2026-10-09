import { amountIn, parseChatLog, parsePhotoLog } from '../chatLog';

const today = new Date(2026, 9, 10); // 10 Oct 2026
const parse = (text: string, lenders: string[] = []) => parseChatLog(text, lenders, today);

describe('amountIn', () => {
  it('reads pesos but not minutes or dates', () => {
    expect(amountIn('gumastos ako ng ₱1,500')).toBe(150_000);
    expect(amountIn('umutang ng 2k sa GCash')).toBe(200_000);
    expect(amountIn('30 minutes sa TikTok')).toBeNull();
    expect(amountIn('500 sa Tala due 2026-10-30')).toBe(50_000);
  });
});

describe('parseChatLog', () => {
  it('logs spending in Tagalog, Taglish and English', () => {
    expect(parse('Gumastos ako ng 250 sa pagkain')).toEqual({
      kind: 'spent',
      amount: 25_000,
      item: 'pagkain',
      isNeed: true,
    });
    expect(parse('bumili ako ng shoes 1500')).toEqual({
      kind: 'spent',
      amount: 150_000,
      item: 'shoes',
      isNeed: false,
    });
    expect(parse('spent ₱300 on grab')).toMatchObject({ kind: 'spent', item: 'grab', isNeed: true });
  });

  it('turns a payment to a known lender into a debt payment', () => {
    expect(parse('nagbayad ako ng 500 sa Tala', ['Tala', 'BillEase'])).toEqual({
      kind: 'payment',
      amount: 50_000,
      lender: 'Tala',
    });
    expect(parse('paid 1,000 to billease', ['Tala', 'BillEase'])).toMatchObject({
      kind: 'payment',
      lender: 'BillEase',
    });
  });

  it('keeps bills paid to someone who is not a lender as spending', () => {
    expect(parse('nagbayad ako ng 300 sa kuryente', ['Tala'])).toMatchObject({
      kind: 'spent',
      item: 'kuryente',
      isNeed: true,
    });
  });

  it('asks which debt when a payment names none and there are several', () => {
    expect(parse('nagbayad ako ng 500', ['Tala', 'BillEase'])).toEqual({
      kind: 'gap',
      need: 'lender',
      lenders: ['Tala', 'BillEase'],
    });
    expect(parse('nagbayad ako ng 500', ['Tala'])).toMatchObject({ kind: 'payment', lender: 'Tala' });
  });

  it('logs new borrowing with a due date', () => {
    expect(parse('umutang ako ng 2000 sa GCash due Oct 30')).toEqual({
      kind: 'debt',
      amount: 200_000,
      lender: 'GCash',
      direction: 'owed',
      dueDate: '2026-10-30',
    });
    expect(parse('nangutang ako ng 3k kay Ate Liza hanggang a-15')).toMatchObject({
      lender: 'Ate Liza',
      dueDate: '2026-10-15',
    });
  });

  it('logs money lent to someone', () => {
    expect(parse('pinautang ko si Mark ng 500')).toMatchObject({
      kind: 'debt',
      direction: 'lent',
      lender: 'Mark',
      amount: 50_000,
    });
  });

  it('logs scrolling time and breaks', () => {
    expect(parse('nag-scroll ako ng 45 minutes sa TikTok')).toEqual({
      kind: 'scroll',
      minutes: 45,
      app: 'TikTok',
    });
    expect(parse('scrolled 2 hours on Facebook')).toMatchObject({ minutes: 120, app: 'Facebook' });
    expect(parse('nag-break ako')).toEqual({ kind: 'break' });
  });

  it('asks for what is missing instead of guessing', () => {
    expect(parse('gumastos ako sa pagkain')).toEqual({ kind: 'gap', need: 'amount' });
    expect(parse('umutang ako ng 500')).toEqual({ kind: 'gap', need: 'lender' });
  });

  it('leaves questions and chat to Ginto', () => {
    expect(parse('Kaya ko ba ang ₱1,500?')).toBeNull();
    expect(parse('Okay bang umutang ng ₱2,000?')).toBeNull();
    expect(parse('Ano ang babayaran ko this month')).toBeNull();
    expect(parse('Stressed ako sa pera')).toBeNull();
  });
});

describe('parsePhotoLog', () => {
  const photo = (text: string, lenders: string[] = []) => parsePhotoLog(text, lenders, today);

  it('logs a store receipt from its total, not the subtotal', () => {
    const receipt = [
      'JOLLIBEE SM NORTH',
      'OFFICIAL RECEIPT',
      '1 Chickenjoy 1pc   99.00',
      '1 Spaghetti        65.00',
      'SUBTOTAL          164.00',
      'VAT                17.57',
      'TOTAL             164.00',
      'CASH              200.00',
      'CHANGE             36.00',
    ].join('\n');
    expect(photo(receipt)).toEqual({
      kind: 'spent',
      amount: 16_400,
      item: 'JOLLIBEE SM NORTH',
      isNeed: false,
    });
  });

  it('turns an e-wallet payment to an open lender into a debt payment', () => {
    const gcash = ['You have paid', 'PHP 1,250.00', 'to Tala Philippines', 'Ref No. 1009 234 567890'].join('\n');
    expect(photo(gcash, ['Tala'])).toEqual({ kind: 'payment', amount: 125_000, lender: 'Tala' });
  });

  it('logs an e-wallet payment to a shop as spending', () => {
    const maya = ['Payment successful', 'Amount paid', '₱450.00', 'Paid to Meralco', 'Oct 10, 2026'].join('\n');
    expect(photo(maya)).toMatchObject({ kind: 'spent', amount: 45_000, item: 'Meralco' });
  });

  it('logs a loan app screen as a new debt with its due date', () => {
    const loan = ['Digido', 'Loan approved!', 'Loan amount: ₱3,000', 'Due date: 2026-10-24'].join('\n');
    expect(photo(loan)).toEqual({
      kind: 'debt',
      amount: 300_000,
      lender: 'Digido',
      direction: 'owed',
      dueDate: '2026-10-24',
    });
  });

  it('asks for the amount when a receipt total cannot be read', () => {
    expect(photo('SARI-SARI STORE\nOFFICIAL RECEIPT\nTOTAL')).toEqual({ kind: 'gap', need: 'amount' });
  });

  it('leaves ordinary photos to Ginto', () => {
    expect(photo('Happy birthday Mama! See you Sunday')).toBeNull();
    expect(photo('')).toBeNull();
  });
});
