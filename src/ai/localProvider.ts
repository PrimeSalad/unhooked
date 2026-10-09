// On-device reflection generator: deterministic templates filled with numbers that
// src/domain already computed. Always works offline; never invents a number.

import { formatPHP } from '@/domain/money';

import type { LabeledLine, PauseContext, Reflection, ReflectionProvider, Tone } from './types';

export function pickTone(ctx: PauseContext): Tone {
  const c = ctx.latestCheckIn;
  return c && (c.stress >= 4 || c.fatigue >= 4) ? 'gentle' : 'neutral';
}

const num = (v: string | number | undefined) => (typeof v === 'number' ? v : Number(v ?? 0));

function checkout(f: PauseContext['facts'], tone: Tone): Omit<Reflection, 'tone' | 'source'> {
  const price = formatPHP(num(f.price));
  const lines: LabeledLine[] = [];
  const suggestions: LabeledLine[] = [];

  if (f.nextDueLabel) lines.push({ certainty: 'fact', text: String(f.nextDueLabel) });

  if (!f.hasBudget) {
    lines.push({
      certainty: 'suggestion',
      text: 'Add your monthly budget in Spend so I can estimate what is left after this.',
    });
    return {
      headline:
        tone === 'gentle' ? 'No rush. Let it sit for a moment.' : `Is ${price} worth it today?`,
      lines,
      suggestions: [{ certainty: 'suggestion', text: 'Waiting a day costs nothing.' }],
    };
  }

  const left = formatPHP(num(f.remainingAfter));
  lines.push({ certainty: 'estimate', text: `After ${price}, about ${left} is left this month.` });

  const verdict = String(f.verdict);
  if (verdict === 'conflicts') {
    lines.push({
      certainty: 'estimate',
      text: `Your repayments would be about ${formatPHP(num(f.shortfall))} short.`,
    });
    suggestions.push({
      certainty: 'suggestion',
      text: 'Save it for 24 hours, or wait until after payday.',
    });
    return {
      headline:
        tone === 'gentle'
          ? 'This one might make the month harder.'
          : 'This one could pinch your repayment.',
      lines,
      suggestions,
    };
  }
  if (verdict === 'tight') {
    suggestions.push({
      certainty: 'suggestion',
      text: 'A cheaper option or a short wait keeps you safe.',
    });
    return { headline: 'You can, but it gets tight.', lines, suggestions };
  }
  suggestions.push({
    certainty: 'suggestion',
    text: 'If it still feels right after the pause, go for it.',
  });
  return { headline: 'Looks affordable. Still want it?', lines, suggestions };
}

function borrow(f: PauseContext['facts'], tone: Tone): Omit<Reflection, 'tone' | 'source'> {
  const amount = formatPHP(num(f.amount));
  const lines: LabeledLine[] = [];
  if (num(f.owedTotal) > 0) {
    lines.push({
      certainty: 'fact',
      text: `You already owe ${formatPHP(num(f.owedTotal))} in total.`,
    });
  }
  if (f.nextDueLabel) lines.push({ certainty: 'fact', text: String(f.nextDueLabel) });
  if (num(f.dueThisMonth) > 0) {
    lines.push({
      certainty: 'estimate',
      text: `With ${amount} more, ${formatPHP(num(f.dueThisMonth) + num(f.amount))} would be due soon.`,
    });
  }
  if (!lines.length) {
    lines.push({
      certainty: 'suggestion',
      text: 'Check the full repayment amount and due date before you agree.',
    });
  }
  return {
    headline:
      num(f.owedTotal) > 0
        ? tone === 'gentle'
          ? 'Another loan would add to what is already heavy.'
          : 'Another loan would stack on top of this month.'
        : `Before you borrow ${amount}, take a breath.`,
    lines,
    suggestions: [
      { certainty: 'suggestion', text: 'Ask your lender for a payment arrangement first.' },
    ],
  };
}

export const localProvider: ReflectionProvider = {
  id: 'local',
  async reflect(ctx: PauseContext): Promise<Reflection> {
    const tone = pickTone(ctx);
    const body = ctx.kind === 'borrow' ? borrow(ctx.facts, tone) : checkout(ctx.facts, tone);
    return { ...body, tone, source: 'local' };
  },
};
