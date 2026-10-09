// On-device reflection generator: deterministic templates filled with domain facts.
// This is the default and must always work offline. See plan.md Phase 4.

import type { PauseContext, Reflection, ReflectionProvider, Tone } from './types';

export function pickTone(ctx: PauseContext): Tone {
  const c = ctx.latestCheckIn;
  return c && (c.stress >= 4 || c.fatigue >= 4) ? 'gentle' : 'neutral';
}

export const localProvider: ReflectionProvider = {
  id: 'local',
  async reflect(ctx: PauseContext): Promise<Reflection> {
    // TODO(P4): replace with template tables per PauseKind × Tone (src/ai/templates.ts).
    return {
      headline: 'Take a breath before you decide.',
      lines: [],
      suggestions: [],
      tone: pickTone(ctx),
      source: 'local',
    };
  },
};
