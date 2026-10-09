// Guardrails for text produced by the on-device language model.
// The model is allowed to phrase; it is never allowed to introduce a number that
// src/domain did not compute, and it must stay inside the R4 tone rules.
// Pure TS: no React, Expo or native imports.

import { formatPHP } from '@/domain/money';

export type GuardVerdict =
  | { ok: true }
  | { ok: false; reason: 'empty' | 'unknown_number' | 'shame' | 'guarantee' | 'too_long' };

/** Numeric tokens as a reader would see them: "4,500", "899", "3.5". */
export function numbersIn(text: string): string[] {
  return [...text.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => m[0].replace(/,$/, ''));
}

/**
 * Every number the model may repeat. Integer values are treated as centavos and
 * contribute both their peso rendering ("4,500") and the raw value ("450000");
 * strings contribute the numbers they already contain.
 */
export function allowedNumbers(values: Iterable<string | number>): Set<string> {
  const out = new Set<string>();
  for (const value of values) {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) continue;
      for (const n of numbersIn(String(value))) out.add(n);
      if (Number.isSafeInteger(value)) {
        for (const n of numbersIn(formatPHP(Math.abs(value)))) out.add(n);
        // Whole pesos without the thousands separator ("4500") read the same to a user.
        if (value % 100 === 0) out.add(String(Math.abs(value) / 100));
      }
    } else {
      for (const n of numbersIn(value)) out.add(n);
    }
  }
  return out;
}

const SHAME = /\b(lazy|stupid|dumb|foolish|irresponsible|reckless|pathetic|shameful|ashamed|failure|weak|wasteful|tanga|bobo|gastador|walang kwenta)\b/i;
const GUARANTEE = /\b(guarantee[ds]?|definitely will|will surely|promise[ds]? (?:you|that)|100%)\b/i;

/**
 * Accepts model text only when every number is provenanced and the tone rules hold.
 * Passing 'any' skips the number check — used for photo answers, whose amounts come
 * from the user's own document rather than the records summary.
 */
export function vetModelText(
  text: string,
  allowed: Set<string> | 'any',
  maxChars = 320,
): GuardVerdict {
  const clean = text.trim();
  if (!clean) return { ok: false, reason: 'empty' };
  if (clean.length > maxChars) return { ok: false, reason: 'too_long' };
  if (SHAME.test(clean)) return { ok: false, reason: 'shame' };
  if (GUARANTEE.test(clean)) return { ok: false, reason: 'guarantee' };
  if (allowed === 'any') return { ok: true };
  for (const n of numbersIn(clean)) {
    if (!allowed.has(n) && !allowed.has(n.replace(/,/g, ''))) {
      return { ok: false, reason: 'unknown_number' };
    }
  }
  return { ok: true };
}

/** Strips markdown noise (bullets, bold, quotes) that small models like to add. */
export function tidyModelLine(line: string): string {
  return line
    .replace(/^[\s*\-•>]+/, '')
    .replace(/\*\*/g, '')
    .replace(/^["“]|["”]$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
