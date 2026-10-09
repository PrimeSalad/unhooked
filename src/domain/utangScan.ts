// Utang Scanner: reads a loan app screenshot's text (OCR or pasted) and pulls out the facts.
// Pure. It never says a lender is legit; it only reports what the text shows.

import { assessMessage, type MessageRisk } from './messageRisk';
import type { Centavos } from './money';

export interface LoanScan {
  amount: Centavos | null;
  dueDate: string | null; // YYYY-MM-DD
  lender: string | null;
  secReg: string | null;
  caNumber: string | null;
  risk: MessageRisk;
}

/** Names only, used to spot the lender in text. Not a list of registered or banned lenders. */
const LENDER_NAMES = [
  'Tala',
  'Cashalo',
  'Digido',
  'JuanHand',
  'BillEase',
  'Home Credit',
  'Atome',
  'GLoan',
  'GGives',
  'GCredit',
  'Maya Credit',
  'Finbro',
  'MoneyCat',
  'Cash Express',
  'Robocash',
  'UnaCash',
  'Mocasa',
  'Pesoloan',
  'Pera Agad',
  'CashMart',
  'Kviku',
  'Online Loans Pilipinas',
];

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const toCentavos = (raw: string): Centavos | null => {
  const n = Number(raw.replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
};

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

function validDate(y: number, m: number, d: number): boolean {
  const date = new Date(y, m, d);
  return date.getFullYear() === y && date.getMonth() === m && date.getDate() === d;
}

/** No year given: this year, or next year if the date already passed by more than 60 days. */
function guessYear(m: number, d: number, today: Date): number {
  const y = today.getFullYear();
  const diff = new Date(y, m, d).getTime() - today.getTime();
  return diff < -60 * 86400000 ? y + 1 : y;
}

function findAmount(text: string): Centavos | null {
  // What you must pay beats what you borrowed.
  for (const label of [
    'total (?:amount )?due|amount due|total repayment|repayment amount|amount to pay|babayaran',
    'outstanding|balance',
    'loan amount|principal',
  ]) {
    const m = new RegExp(
      `(?:${label})[^\\d\\n]{0,24}?(?:₱|php|p)?\\s?(\\d[\\d,]*(?:\\.\\d{1,2})?)`,
      'i',
    ).exec(text);
    if (m) return toCentavos(m[1]!);
  }
  let best: Centavos | null = null;
  for (const m of text.matchAll(/(?:₱|php|\bp)\s?(\d[\d,]*(?:\.\d{1,2})?)/gi)) {
    const c = toCentavos(m[1]!);
    if (c && (!best || c > best)) best = c;
  }
  return best;
}

function findDueDate(text: string, today: Date): string | null {
  const near = /(?:due|deadline|bayaran|until|on or before)[^\n]{0,40}/i.exec(text)?.[0];
  for (const scope of near ? [near, text] : [text]) {
    let m = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(scope);
    if (m && validDate(+m[1]!, +m[2]! - 1, +m[3]!)) return iso(+m[1]!, +m[2]! - 1, +m[3]!);
    m = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/.exec(scope);
    if (m) {
      const y = m[3]!.length === 2 ? 2000 + +m[3]! : +m[3]!;
      if (validDate(y, +m[1]! - 1, +m[2]!)) return iso(y, +m[1]! - 1, +m[2]!);
    }
    m =
      /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?/i.exec(
        scope,
      );
    if (m) {
      const mo = MONTHS.indexOf(m[1]!.toLowerCase());
      const d = +m[2]!;
      const y = m[3] ? +m[3] : guessYear(mo, d, today);
      if (validDate(y, mo, d)) return iso(y, mo, d);
    }
    m =
      /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s*(\d{4})?/i.exec(
        scope,
      );
    if (m) {
      const mo = MONTHS.indexOf(m[2]!.toLowerCase());
      const d = +m[1]!;
      const y = m[3] ? +m[3] : guessYear(mo, d, today);
      if (validDate(y, mo, d)) return iso(y, mo, d);
    }
  }
  return null;
}

function findLender(text: string): string | null {
  const lower = text.toLowerCase();
  const known = LENDER_NAMES.find((n) => lower.includes(n.toLowerCase()));
  if (known) return known;
  const labeled =
    /(?:lender|from|company|lending company|financing company)\s*[:-]\s*([^\n,.]{2,40})/i.exec(
      text,
    );
  return labeled ? labeled[1]!.trim() : null;
}

export function scanLoanText(text: string, today = new Date()): LoanScan {
  const secReg =
    /SEC\s*(?:Reg(?:istration)?\.?|Registration)\s*(?:No\.?|Number|#)?\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{4,})/i.exec(
      text,
    )?.[1] ?? null;
  const caNumber =
    /(?:Certificate of Authority|\bC\.?\s?A\.?)\s*(?:No\.?|Number|#)\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{0,})/i.exec(
      text,
    )?.[1] ?? null;
  return {
    amount: findAmount(text),
    dueDate: findDueDate(text, today),
    lender: findLender(text),
    secReg,
    caNumber,
    risk: assessMessage(text),
  };
}

export type LenderCheck = 'both' | 'partial' | 'none';

export function lenderCheck(scan: Pick<LoanScan, 'secReg' | 'caNumber'>): LenderCheck {
  if (scan.secReg && scan.caNumber) return 'both';
  return scan.secReg || scan.caNumber ? 'partial' : 'none';
}

export const LENDER_CHECK_COPY: Record<LenderCheck, string> = {
  both: 'The text shows an SEC registration number and a Certificate of Authority number. Numbers can be copied, so match them on the SEC website before you pay.',
  partial:
    'Only one of the two numbers is shown. A lending company needs both an SEC registration and a Certificate of Authority. Check the SEC website before you pay or share anything.',
  none: 'No SEC registration or Certificate of Authority number in this text. Legit lending apps show both. Check the lender on the SEC website before you pay or share anything.',
};
