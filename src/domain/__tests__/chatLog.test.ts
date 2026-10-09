import { amountIn, parseChatLog } from '../chatLog';

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
