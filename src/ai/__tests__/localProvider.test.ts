import { formatPHP } from '@/domain/money';
import { checkoutPauseFacts } from '@/domain/pauseFacts';
import type { WellnessCheckIn } from '@/domain/types';

import { localProvider, pickTone } from '../localProvider';
import { templates } from '../templates';
import type { PauseContext, Reflection } from '../types';

const checkIn = (
  stress: WellnessCheckIn['stress'],
  fatigue: WellnessCheckIn['fatigue'],
): WellnessCheckIn => ({
  id: 'checkin-1',
  stress,
  fatigue,
  mood: 3,
  createdAt: '2026-10-09T00:00:00.000Z',
});

const textOf = (reflection: Reflection) =>
  [
    reflection.headline,
    ...reflection.lines.map((line) => line.text),
    ...reflection.suggestions.map((line) => line.text),
  ].join(' ');

const numbersIn = (text: string) =>
  [...text.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((match) => match[0]);

describe('local reflection templates', () => {
  it('uses gentle copy when stress or fatigue is high', async () => {
    for (const kind of ['borrow', 'checkout', 'scroll'] as const) {
      const base: PauseContext = { kind, facts: {}, latestCheckIn: checkIn(1, 1) };
      expect(pickTone(base)).toBe('neutral');
      for (const latestCheckIn of [checkIn(4, 1), checkIn(1, 4)]) {
        const reflection = await localProvider.reflect({ ...base, latestCheckIn });
        expect(reflection.tone).toBe('gentle');
        expect(reflection.source).toBe('local');
        expect(reflection.headlineCertainty).toMatch(/^(suggestion|estimate)$/);
        expect(reflection.headline).toMatch(/no rush|take a breath|quick breath/i);
      }
    }
  });

  it('keeps every template free of shame, guarantees, and literal numbers', () => {
    const copy = JSON.stringify(templates);
    expect(copy).not.toMatch(
      /\b(?:lazy|stupid|failure|irresponsible|weak|shameful|guaranteed|always|never)\b/i,
    );
    expect(copy).not.toMatch(/\d/);
  });

  it('renders only numbers supplied as facts, with no arithmetic inside the provider', async () => {
    const contexts: PauseContext[] = [
      {
        kind: 'checkout',
        facts: {
          price: 450000,
          hasBudget: 1,
          verdict: 'conflicts',
          remainingAfter: 450000,
          shortfall: 150000,
        },
        latestCheckIn: null,
      },
      {
        kind: 'borrow',
        facts: { amount: 200000, owedTotal: 750000, dueThisMonth: 300000 },
        latestCheckIn: null,
      },
      { kind: 'scroll', facts: { app: 'TikTok', minutes: 37 }, latestCheckIn: null },
    ];

    for (const ctx of contexts) {
      const reflection = await localProvider.reflect(ctx);
      const allowed = new Set(
        Object.values(ctx.facts).flatMap((value) =>
          typeof value === 'number'
            ? [...numbersIn(formatPHP(value)), ...numbersIn(String(value))]
            : numbersIn(value),
        ),
      );
      for (const number of numbersIn(textOf(reflection))) expect(allowed.has(number)).toBe(true);
      expect(
        reflection.lines.every(
          (line) => line.certainty === 'fact' || line.certainty === 'estimate',
        ),
      ).toBe(true);
      expect(reflection.suggestions.every((line) => line.certainty === 'suggestion')).toBe(true);
      expect(reflection.lines.length).toBeLessThanOrEqual(3);
      expect(reflection.headlineCertainty).toMatch(/^(suggestion|estimate)$/);
    }
  });

  it('does not display a fabricated price or amount when a fact is absent', async () => {
    const checkout = await localProvider.reflect({
      kind: 'checkout',
      facts: { hasBudget: 1 },
      latestCheckIn: null,
    });
    const borrow = await localProvider.reflect({ kind: 'borrow', facts: {}, latestCheckIn: null });
    expect(textOf(checkout)).not.toMatch(/₱|NaN/);
    expect(textOf(borrow)).not.toMatch(/₱|NaN/);
  });

  it('phrases saved purchase facts without changing the affordability calculation', async () => {
    const pause = checkoutPauseFacts({
      purchase: { item: 'Headphones', price: 450000 },
      budget: {
        monthlyIncome: 2200000,
        monthlyFixedBills: 1200000,
        savingsGoalMonthly: 100000,
        payday: null,
      },
      dueThisMonth: 600000,
      spentThisMonth: 0,
      nextDueLabel: '',
      checkIn: checkIn(4, 2),
    });
    const reflection = await localProvider.reflect({
      kind: 'checkout',
      facts: pause.facts,
      latestCheckIn: pause.checkIn,
    });

    expect(reflection.tone).toBe('gentle');
    expect(reflection.lines).toEqual(
      expect.arrayContaining([
        { certainty: 'fact', text: `The planned price is ${formatPHP(450000)}.` },
        {
          certainty: 'estimate',
          text: `Based on your budget, repayments may be ${formatPHP(150000)} short.`,
        },
      ]),
    );
  });
});
