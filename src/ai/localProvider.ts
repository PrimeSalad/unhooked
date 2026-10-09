// On-device reflection generator: deterministic templates filled with numbers that
// src/domain already computed. Always works offline; never invents a number.

import { formatPHP } from '@/domain/money';

import { templates } from './templates';
import type { LabeledLine, PauseContext, Reflection, ReflectionProvider, Tone } from './types';

export function pickTone(ctx: PauseContext): Tone {
  const c = ctx.latestCheckIn;
  return c && (c.stress >= 4 || c.fatigue >= 4) ? 'gentle' : 'neutral';
}

const recordedAmount = (value: string | number | undefined): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) ? value : null;

function checkout(f: PauseContext['facts'], tone: Tone): Omit<Reflection, 'tone' | 'source'> {
  const price = recordedAmount(f.price);
  const lines: LabeledLine[] = [];
  if (price !== null && price > 0)
    lines.push({ certainty: 'fact', text: `The planned price is ${formatPHP(price)}.` });

  const remainingAfter = recordedAmount(f.remainingAfter);
  if (remainingAfter !== null && f.hasBudget === 1 && price !== null && price > 0) {
    lines.push({
      certainty: 'estimate',
      text: `After this purchase, about ${formatPHP(remainingAfter)} is left this month.`,
    });
  }

  const shortfall = recordedAmount(f.shortfall);
  if (f.verdict === 'conflicts' && shortfall !== null && shortfall > 0) {
    lines.push({
      certainty: 'estimate',
      text: `Based on your budget, repayments may be ${formatPHP(shortfall)} short.`,
    });
  }
  if (lines.length < 3 && typeof f.nextDueLabel === 'string' && f.nextDueLabel)
    lines.push({ certainty: 'fact', text: f.nextDueLabel });

  const variant =
    price === null || price <= 0
      ? 'missingPurchase'
      : f.hasBudget !== 1
        ? 'noBudget'
        : remainingAfter === null
          ? 'unavailableEstimate'
          : f.verdict === 'conflicts' || f.verdict === 'tight' || f.verdict === 'comfortable'
            ? f.verdict
            : 'unavailableEstimate';
  const copy = templates.checkout[tone][variant];
  return {
    headline: copy.headline,
    headlineCertainty:
      variant === 'conflicts' || variant === 'tight' || variant === 'comfortable'
        ? 'estimate'
        : 'suggestion',
    lines,
    suggestions: [{ certainty: 'suggestion', text: copy.suggestion }],
  };
}

function borrow(f: PauseContext['facts'], tone: Tone): Omit<Reflection, 'tone' | 'source'> {
  const amount = recordedAmount(f.amount);
  const owedTotal = recordedAmount(f.owedTotal);
  const dueThisMonth = recordedAmount(f.dueThisMonth);
  const remainingBudget = recordedAmount(f.remainingBudget);
  const lines: LabeledLine[] = [];
  if (remainingBudget === null && amount !== null && amount > 0)
    lines.push({ certainty: 'fact', text: `You are considering ${formatPHP(amount)}.` });
  if (owedTotal !== null && owedTotal > 0) {
    lines.push({
      certainty: 'fact',
      text: `Your records show ${formatPHP(owedTotal)} still owed.`,
    });
  }
  if (dueThisMonth !== null && dueThisMonth > 0) {
    lines.push({
      certainty: 'fact',
      text: `Your records show ${formatPHP(dueThisMonth)} due by month-end.`,
    });
  }
  if (remainingBudget !== null && lines.length < 3) {
    lines.push({
      certainty: 'estimate',
      text:
        remainingBudget >= 0
          ? `Based on what you entered, about ${formatPHP(remainingBudget)} remains after bills, savings, tracked spending and dues this month.`
          : `Based on what you entered, this month may be ${formatPHP(-remainingBudget)} short after bills, savings, tracked spending and dues.`,
    });
  }
  if (lines.length < 3 && typeof f.nextDueLabel === 'string' && f.nextDueLabel)
    lines.push({ certainty: 'fact', text: f.nextDueLabel });
  const copy = templates.borrow[tone][owedTotal !== null && owedTotal > 0 ? 'withDebt' : 'noDebt'];
  return {
    headline: copy.headline,
    headlineCertainty: 'suggestion',
    lines,
    suggestions: [{ certainty: 'suggestion', text: copy.suggestion }],
  };
}

function scroll(f: PauseContext['facts'], tone: Tone): Omit<Reflection, 'tone' | 'source'> {
  const app = typeof f.app === 'string' && f.app.trim() ? f.app : 'your feed';
  const minutes = recordedAmount(f.minutes);
  const lines: LabeledLine[] = [];

  if (minutes !== null && minutes > 0) {
    lines.push({
      certainty: 'fact',
      text: `This session on ${app} has lasted ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`,
    });
  } else {
    lines.push({ certainty: 'fact', text: `This check-in is for ${app}.` });
  }
  const copy = templates.scroll[tone];
  return {
    headline: copy.headline,
    headlineCertainty: 'suggestion',
    lines,
    suggestions: [{ certainty: 'suggestion', text: copy.suggestion }],
  };
}

export const localProvider: ReflectionProvider = {
  id: 'local',
  async reflect(ctx: PauseContext): Promise<Reflection> {
    const tone = pickTone(ctx);
    const body =
      ctx.kind === 'borrow'
        ? borrow(ctx.facts, tone)
        : ctx.kind === 'scroll'
          ? scroll(ctx.facts, tone)
          : checkout(ctx.facts, tone);
    return { ...body, tone, source: 'local' };
  },
};
