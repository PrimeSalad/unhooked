// Log from Ask Ginto: turns a typed or spoken line ("gumastos ako ng 250 sa pagkain",
// "paid 500 to Tala", "nag-scroll ako ng 30 minutes sa TikTok") into one record to confirm.
// Deterministic rules only, never a model: every amount and name comes from the user's words.
// Pure TS: no React, Expo or database imports.

import { parsePesoInput, type Centavos } from './money';
import type { DebtDirection, ISODate } from './types';
import { scanLoanText } from './utangScan';

export type ChatLogEntry =
  | { kind: 'spent'; amount: Centavos; item: string; isNeed: boolean }
  | { kind: 'payment'; amount: Centavos; lender: string }
  | { kind: 'debt'; amount: Centavos; lender: string; direction: DebtDirection; dueDate: ISODate | null }
  | { kind: 'scroll'; minutes: number; app: string }
  | { kind: 'break' };

/** Why a line that looks like a log could not become one; the chat asks for the missing part. */
export type ChatLogGap = { kind: 'gap'; need: 'amount' | 'lender' | 'minutes'; lenders?: string[] };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const has = (t: string, ...words: string[]) =>
  words.some((w) => new RegExp(`(^|[^a-z0-9ñ])${escapeRe(w)}(?![a-z0-9ñ])`, 'i').test(t));

const SPENT = ['gumastos', 'gastos', 'nagastos', 'bumili', 'binili', 'nabili', 'spent', 'bought', 'paid for', 'nagbayad para sa'];
const PAID = ['nagbayad', 'binayaran', 'bayad', 'nagbayad ako', 'paid', 'repaid', 'payment'];
const BORROWED = ['umutang', 'nangutang', 'utang ako', 'humiram', 'nanghiram', 'borrowed', 'loaned', 'took a loan', 'nag-loan', 'nagloan'];
const LENT = ['pinautang', 'nagpautang', 'pinahiram', 'nagpahiram', 'lent', 'lend'];
const SCROLLED = ['nag-scroll', 'nagscroll', 'scroll', 'scrolled', 'nanood', 'naglaro', 'watched'];
const BREAK = ['nag-break', 'nagbreak', 'took a break', 'had a break', 'break ako', 'nagpahinga'];

// Spending that keeps life running; anything else counts as a want.
const NEEDS = ['pagkain', 'food', 'grocery', 'groceries', 'bigas', 'ulam', 'pamasahe', 'fare', 'jeep', 'grab', 'transpo', 'transport', 'load', 'kuryente', 'electric', 'tubig', 'water', 'upa', 'rent', 'renta', 'gamot', 'medicine', 'bills', 'bill', 'tuition', 'school', 'internet', 'wifi'];

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTHS_TL: Record<string, number> = { enero: 0, pebrero: 1, marso: 2, abril: 3, mayo: 4, hunyo: 5, hulyo: 6, agosto: 7, setyembre: 8, oktubre: 9, nobyembre: 10, disyembre: 11 };

/** "₱1,500", "1500", "2k", "P250", "250 pesos". Days, minutes and dates are not amounts. */
export function amountIn(text: string): Centavos | null {
  const cleaned = text
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(/\b\d+\s*(?:mins?|minutes?|minuto|hrs?|hours?|oras)\b/gi, ' ')
    .replace(/\b(?:due|until|hanggang|deadline)\b.*$/i, ' ');
  const m =
    cleaned.match(/(?:₱|php|\bp)\s?(\d[\d,]*(?:\.\d{1,2})?)\s?(k)?(?![\d,])/i) ??
    cleaned.match(/(\d[\d,]*(?:\.\d{1,2})?)\s?(k)?(?![\d,])/i);
  if (!m?.[1]) return null;
  const base = parsePesoInput(m[1]);
  if (base === null || base <= 0) return null;
  return m[2] ? base * 1000 : base;
}

function minutesIn(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(mins?|minutes?|minuto|hrs?|hours?|oras)\b/i);
  if (!m?.[1] || !m[2]) return null;
  const n = Number(m[1]);
  const minutes = /^(h|o)/i.test(m[2]) ? n * 60 : n;
  return minutes > 0 && minutes <= 24 * 60 ? Math.round(minutes) : null;
}

const STOP = /\b(ng|na|ako|ko|mo|ang|para|due|until|hanggang|deadline|kanina|today|ngayon|kahapon|yesterday|this|last|for|on|at|worth|pesos?|php|lang|po|naman)\b|₱|\d/i;

/** The words after a marker ("sa", "kay", "to", "from", "on"), up to three, stopping at filler or numbers. */
function nameAfter(text: string, markers: string[]): string | null {
  for (const marker of markers) {
    const m = text.match(new RegExp(`(?:^|\\s)${escapeRe(marker)}\\s+(.+)$`, 'i'));
    if (!m?.[1]) continue;
    const words: string[] = [];
    for (const word of m[1].split(/\s+/)) {
      const clean = word.replace(/[.,!?;:]+$/, '');
      if (!clean || STOP.test(clean)) break;
      words.push(clean);
      if (words.length === 3) break;
    }
    if (words.length) return words.join(' ');
  }
  return null;
}

function dueDateIn(text: string, today: Date): ISODate | null {
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso?.[1]) return iso[1];
  const tail = text.match(/\b(?:due|until|hanggang|deadline)\b(.*)$/i)?.[1];
  if (!tail) return null;
  const named = tail.match(/([a-z]+)\.?\s+(\d{1,2})/i);
  if (named?.[1]) {
    const word = named[1].toLowerCase();
    const month = MONTHS_TL[word] ?? MONTHS.indexOf(word.slice(0, 3));
    const day = Number(named[2]);
    if (month >= 0 && day >= 1 && day <= 31) {
      let year = today.getFullYear();
      if (new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate())) year += 1;
      return isoDate(new Date(year, month, day));
    }
  }
  // "due on the 15th" / "hanggang a-kinse": the next time that day of the month comes.
  const dayOnly = tail.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (dayOnly?.[1]) {
    const day = Number(dayOnly[1]);
    if (day < 1 || day > 31) return null;
    const next = new Date(today.getFullYear(), today.getMonth(), day);
    if (next.getDate() < today.getDate() || next.getMonth() !== today.getMonth()) {
      next.setMonth(today.getMonth() + 1, day);
    }
    return isoDate(next);
  }
  return null;
}

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** An open debt whose lender name appears in the text (either way round, case-insensitive). */
export function matchLender(text: string, lenders: string[]): string | null {
  const t = text.toLowerCase();
  const name = nameAfter(text, ['sa', 'kay', 'to', 'kina'])?.toLowerCase();
  return (
    lenders.find((l) => t.includes(l.toLowerCase())) ??
    (name ? (lenders.find((l) => l.toLowerCase().includes(name)) ?? null) : null)
  );
}

/**
 * Reads one log from a chat line, or null when the line is a question or not a log.
 * `lenders` are the names of open debts the user owes, so "nagbayad ako sa Tala" becomes a
 * payment on that debt and "nagbayad ako ng 300 sa kuryente" stays spending.
 */
export function parseChatLog(
  input: string,
  lenders: string[],
  today: Date = new Date(),
): ChatLogEntry | ChatLogGap | null {
  const text = input.trim().replace(/^(?:i-?log|log|record|ilista|i-record)\s*(?:mo|na|ko)?\s*:?\s*/i, '');
  const t = text.toLowerCase();
  // Questions ("kaya ko ba", "magkano", "can I") belong to the chat, not the log.
  if (/\?\s*$/.test(text) || has(t, 'kaya ko ba', 'magkano', 'ilan', 'how much', 'can i', 'should i', 'pwede ba', 'okay ba', 'okay bang')) {
    return null;
  }

  if (has(t, ...BREAK)) return { kind: 'break' };

  if (has(t, ...LENT)) {
    const amount = amountIn(text);
    if (!amount) return { kind: 'gap', need: 'amount' };
    const lender = nameAfter(text, ['kay', 'si', 'to', 'kina', 'sa']);
    if (!lender) return { kind: 'gap', need: 'lender' };
    return { kind: 'debt', amount, lender, direction: 'lent', dueDate: dueDateIn(text, today) };
  }

  if (has(t, ...BORROWED)) {
    const amount = amountIn(text);
    if (!amount) return { kind: 'gap', need: 'amount' };
    const lender = nameAfter(text, ['sa', 'kay', 'from', 'kina', 'via', 'thru', 'through']);
    if (!lender) return { kind: 'gap', need: 'lender' };
    return { kind: 'debt', amount, lender, direction: 'owed', dueDate: dueDateIn(text, today) };
  }

  if (has(t, ...SCROLLED) && minutesIn(text) != null) {
    const app = nameAfter(text, ['sa', 'on', 'in']) ?? 'Phone';
    return { kind: 'scroll', minutes: minutesIn(text)!, app };
  }
  if (has(t, 'nag-scroll', 'nagscroll', 'scrolled')) return { kind: 'gap', need: 'minutes' };

  const lender = matchLender(text, lenders);
  if (has(t, ...PAID) && (lender || (lenders.length && !has(t, ...SPENT) && !has(t, ...NEEDS)))) {
    const amount = amountIn(text);
    if (!amount) return { kind: 'gap', need: 'amount' };
    if (lender) return { kind: 'payment', amount, lender };
    if (lenders.length === 1 && lenders[0]) return { kind: 'payment', amount, lender: lenders[0] };
    return { kind: 'gap', need: 'lender', lenders };
  }

  if (has(t, ...SPENT, ...PAID)) {
    const amount = amountIn(text);
    if (!amount) return { kind: 'gap', need: 'amount' };
    const item =
      nameAfter(text, ['para sa', 'sa', 'on', 'for', 'ng', 'ang']) ?? 'Logged from chat';
    return { kind: 'spent', amount, item, isNeed: has(item.toLowerCase(), ...NEEDS) };
  }

  return null;
}

// ---- Photos: text read on the phone (OCR) from a receipt, an e-wallet receipt or a loan app ----

const PAID_RECEIPT =
  /\b(you (?:have )?paid|payment (?:successful|received|confirmed|complete)|successfully paid|paid to|amount paid|transaction successful|sent via|bayad na)\b/i;
const STORE_RECEIPT =
  /\b(grand total|total amount|amount due|sub-?total|vatable|vat\b|official receipt|sales invoice|change\b|cashier|qty)\b/i;
const LOAN_SCREEN =
  /\b(loan (?:amount|approved|disbursed)|disbursed|approved amount|principal|repayment|due date|amount to repay|installment)\b/i;

// Pick the total, not the subtotal: labels in order of trust.
const TOTAL_LABELS = [
  'grand total',
  'total amount due',
  'amount due',
  'total amount paid',
  'amount paid',
  'total amount',
  'total',
  'amount',
];

/** A peso amount as a receipt prints it: marked (₱, PHP, P), or with centavos or a thousands comma. */
function receiptAmount(line: string): Centavos | null {
  const m =
    line.match(/(?:₱|php|\bp)\s?(\d[\d,]*(?:\.\d{1,2})?)/i) ??
    line.match(/(?<![\d.])(\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d+\.\d{2})(?![\d])/);
  if (!m?.[1]) return null;
  const value = parsePesoInput(m[1]);
  return value && value > 0 ? value : null;
}

/** The amount on (or right under) the most trusted total label. */
export function receiptTotal(text: string): Centavos | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const label of TOTAL_LABELS) {
    const re = new RegExp(`(?<!sub[- ]?)\\b${escapeRe(label)}\\b`, 'i');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (!re.test(line)) continue;
      const amount = receiptAmount(line) ?? (lines[i + 1] ? receiptAmount(lines[i + 1]!) : null);
      if (amount) return amount;
    }
  }
  return null;
}

/** Store name: the first line with real words, which is how receipts and wallet screens start. */
function firstName(text: string): string | null {
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/\s+/g, ' ');
    if (/[a-z]{3,}/i.test(line) && !/\d{3,}/.test(line) && !PAID_RECEIPT.test(line)) {
      return line.slice(0, 40);
    }
  }
  return null;
}

function paidTo(text: string): string | null {
  const m = text.match(/\b(?:paid to|sent to|to|merchant|biller)\s*:?\s*([A-Za-z][A-Za-z0-9 &.'-]{1,38})/i);
  return m?.[1]?.trim().replace(/\s+/g, ' ') ?? null;
}

/**
 * Reads one log from the text of a photo, or null when it is not a receipt or loan screen
 * (then Ginto describes the photo instead). `lenders` are the user's open debts by name.
 */
export function parsePhotoLog(
  ocrText: string,
  lenders: string[],
  today: Date = new Date(),
): ChatLogEntry | ChatLogGap | null {
  const text = ocrText.trim();
  if (!text) return null;
  const loan = scanLoanText(text, today);
  const knownLender = loan.lender;
  const lower = text.toLowerCase();
  const openLender =
    lenders.find((l) => lower.includes(l.toLowerCase())) ??
    (knownLender ? (lenders.find((l) => l.toLowerCase() === knownLender.toLowerCase()) ?? null) : null);

  if (PAID_RECEIPT.test(text)) {
    const amount = receiptTotal(text) ?? loan.amount;
    if (!amount) return { kind: 'gap', need: 'amount' };
    if (openLender) return { kind: 'payment', amount, lender: openLender };
    const item = paidTo(text) ?? firstName(text) ?? 'Receipt';
    return { kind: 'spent', amount, item, isNeed: has(item.toLowerCase(), ...NEEDS) };
  }

  if (knownLender && LOAN_SCREEN.test(text) && !openLender) {
    if (!loan.amount) return { kind: 'gap', need: 'amount' };
    return {
      kind: 'debt',
      amount: loan.amount,
      lender: knownLender,
      direction: 'owed',
      dueDate: loan.dueDate,
    };
  }

  if (STORE_RECEIPT.test(text)) {
    const amount = receiptTotal(text);
    if (!amount) return { kind: 'gap', need: 'amount' };
    const item = firstName(text) ?? 'Receipt';
    return { kind: 'spent', amount, item, isNeed: has(lower, ...NEEDS) };
  }

  return null;
}
