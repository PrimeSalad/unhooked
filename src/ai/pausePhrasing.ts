// The on-device model's only job in the pause: rephrase the template headline and
// suggestion around facts that src/domain already computed. Pure TS; the native call
// lives in androidLocalAi.ts and the screen decides when to swap text in.

import { allowedNumbers, tidyModelLine, vetModelText } from './guard';
import type { PauseContext, Reflection } from './types';

export const PAUSE_SYSTEM_INSTRUCTION =
  'You are Ginto, a calm goldfish companion inside a Filipino budgeting app. ' +
  'You help a person pause before a money or scrolling decision. ' +
  'You only rephrase facts you are given; you never calculate, never invent amounts, dates or names, ' +
  'never scold, never promise outcomes, and the person always decides. ' +
  'Write plain, warm English in short sentences. Light Taglish is fine.';

const KIND_LABEL = {
  checkout: 'about to buy something',
  borrow: 'thinking of borrowing money',
  scroll: 'checking in during a long scrolling session',
} as const;

export function buildPausePrompt(ctx: PauseContext, template: Reflection): string {
  const facts = template.lines.map((l) => `- (${l.certainty}) ${l.text}`).join('\n');
  return [
    `The person is ${KIND_LABEL[ctx.kind]}. Tone: ${template.tone === 'gentle' ? 'extra gentle, they reported high stress or fatigue today' : 'neutral and kind'}.`,
    'Facts from their own records (the only numbers you may repeat, written exactly as shown):',
    facts || '- (none recorded)',
    '',
    `Current wording to improve: "${template.headline}" / "${template.suggestions[0]?.text ?? ''}"`,
    '',
    'Write exactly two lines and nothing else:',
    'Headline: one sentence, at most 12 words, speaks to the person directly.',
    'Suggestion: one sentence, at most 20 words, offers one practical option; never an order.',
  ].join('\n');
}

export interface PausePhrasing {
  headline: string;
  suggestion: string;
}

/** Tolerates bullets, bold and label case; returns null when the shape is wrong. */
export function parsePausePhrasing(raw: string): PausePhrasing | null {
  const headline = raw.match(/headline\s*[:\-–]\s*(.+)/i)?.[1];
  const suggestion = raw.match(/suggestion\s*[:\-–]\s*(.+)/i)?.[1];
  if (!headline || !suggestion) return null;
  const h = tidyModelLine(headline);
  const s = tidyModelLine(suggestion);
  if (!h || !s || h.length < 8 || s.length < 8) return null;
  return { headline: h, suggestion: s };
}

export interface PhrasingMeta {
  model: string;
  backend: string;
  ms: number;
}

/**
 * Returns the template with the model's wording swapped in, or null if any guard
 * rejects it. Fact and estimate lines are never touched: their numbers come from domain.
 */
export function applyPausePhrasing(
  ctx: PauseContext,
  template: Reflection,
  raw: string,
  meta: PhrasingMeta,
): { reflection: Reflection; rejected?: undefined } | { reflection: null; rejected: string } {
  const parsed = parsePausePhrasing(raw);
  if (!parsed) return { reflection: null, rejected: 'unparsable' };
  const allowed = allowedNumbers([
    ...Object.values(ctx.facts),
    ...template.lines.map((l) => l.text),
  ]);
  for (const line of [parsed.headline, parsed.suggestion]) {
    const verdict = vetModelText(line, allowed, 200);
    if (!verdict.ok) return { reflection: null, rejected: verdict.reason };
  }
  return {
    reflection: {
      ...template,
      headline: parsed.headline,
      headlineCertainty: 'suggestion',
      suggestions: [{ certainty: 'suggestion', text: parsed.suggestion }],
      phrasing: meta,
    },
  };
}
