import { allowedNumbers, numbersIn, tidyModelLine, vetModelText } from '../guard';
import { localProvider } from '../localProvider';
import { applyPausePhrasing, buildPausePrompt, parsePausePhrasing } from '../pausePhrasing';
import type { PauseContext } from '../types';

describe('guard', () => {
  it('derives every rendering of a centavo amount', () => {
    const allowed = allowedNumbers([450_000, 'Due on 2026-10-15']);
    expect(allowed).toEqual(new Set(['450000', '4,500', '4500', '2026', '10', '15']));
  });

  it('rejects numbers the domain never computed', () => {
    const allowed = allowedNumbers([450_000]);
    expect(vetModelText('₱4,500 is a lot this month.', allowed)).toEqual({ ok: true });
    expect(vetModelText('₱5,000 is a lot this month.', allowed)).toEqual({
      ok: false,
      reason: 'unknown_number',
    });
    expect(vetModelText('Wait 2 days.', allowed)).toEqual({ ok: false, reason: 'unknown_number' });
  });

  it("skips the number check for 'any' but still enforces tone and length", () => {
    expect(vetModelText('The receipt totals ₱12,345 due in 7 days.', 'any')).toEqual({ ok: true });
    expect(vetModelText('That ₱12,345 was wasteful of you.', 'any')).toEqual({
      ok: false,
      reason: 'shame',
    });
    expect(vetModelText('x'.repeat(400), 'any', 100)).toEqual({ ok: false, reason: 'too_long' });
  });

  it('rejects shame words and guarantees', () => {
    const allowed = new Set<string>();
    expect(vetModelText('Stop being so irresponsible.', allowed).ok).toBe(false);
    expect(vetModelText('Ang tanga naman.', allowed).ok).toBe(false);
    expect(vetModelText('This will definitely will fix it.', allowed).ok).toBe(false);
    expect(vetModelText('   ', allowed)).toEqual({ ok: false, reason: 'empty' });
  });

  it('tidies markdown that small models add', () => {
    expect(tidyModelLine('- **"Take a breath."**')).toBe('Take a breath.');
    expect(numbersIn('6 × ₱899, total ₱5,394.')).toEqual(['6', '899', '5,394']);
  });
});

describe('pause phrasing', () => {
  const ctx: PauseContext = {
    kind: 'checkout',
    facts: { price: 450_000, hasBudget: 1, verdict: 'conflicts', remainingAfter: 120_000, shortfall: 150_000 },
    latestCheckIn: null,
  };

  it('builds a prompt that lists only domain facts', async () => {
    const template = await localProvider.reflect(ctx);
    const prompt = buildPausePrompt(ctx, template);
    expect(prompt).toMatch(/₱4,500/);
    expect(prompt).toMatch(/Headline:/);
    expect(prompt).not.toMatch(/undefined|NaN/);
  });

  it('parses labelled lines in any shape', () => {
    expect(
      parsePausePhrasing('**Headline:** "₱4,500 can wait a day."\n- Suggestion: Save it for 24 hours.'),
    ).toEqual({ headline: '₱4,500 can wait a day.', suggestion: 'Save it for 24 hours.' });
    expect(parsePausePhrasing('Sure! Here is a headline.')).toBeNull();
  });

  it('swaps wording in but keeps fact lines and rejects invented numbers', async () => {
    const template = await localProvider.reflect(ctx);
    const meta = { model: 'Gemma 3 1B', backend: 'CPU', ms: 1800 };

    const good = applyPausePhrasing(
      ctx,
      template,
      'Headline: ₱4,500 may squeeze a ₱1,500 repayment.\nSuggestion: Saving it for a day keeps your options open.',
      meta,
    );
    expect(good.reflection?.headline).toBe('₱4,500 may squeeze a ₱1,500 repayment.');
    expect(good.reflection?.lines).toEqual(template.lines);
    expect(good.reflection?.phrasing).toEqual(meta);
    expect(good.reflection?.suggestions[0]?.certainty).toBe('suggestion');

    const bad = applyPausePhrasing(
      ctx,
      template,
      'Headline: You will be ₱9,000 short.\nSuggestion: Skip it.',
      meta,
    );
    expect(bad.reflection).toBeNull();
    expect(bad.rejected).toBe('unknown_number');

    const shame = applyPausePhrasing(
      ctx,
      template,
      'Headline: That is a wasteful choice.\nSuggestion: Save it for a day.',
      meta,
    );
    expect(shame.rejected).toBe('shame');
  });
});
