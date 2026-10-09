// The AI layer generates short, labeled text for pause cards, insights and check-ins.
// Everything is generated on the phone: templates and rules, phrased by the on-device model.

import type { Certainty, PauseKind, WellnessCheckIn } from '@/domain/types';

export type Tone = 'gentle' | 'neutral'; // gentle when the user reports high stress

export interface PauseContext {
  kind: PauseKind;
  /** Pre-computed numbers from domain logic. The AI never does the math. */
  facts: Record<string, string | number>;
  latestCheckIn: WellnessCheckIn | null;
}

export interface LabeledLine {
  text: string;
  certainty: Certainty;
}

export interface Reflection {
  headline: string; // one sentence, no shame language
  headlineCertainty: Certainty;
  lines: LabeledLine[]; // 1–3 context lines
  suggestions: LabeledLine[]; // 1–3 practical options
  tone: Tone;
  source: 'local';
  /** Present when the on-device language model rephrased the headline and suggestion. */
  phrasing?: { model: string; backend: string; ms: number };
}

export interface Insight {
  id: string;
  module: 'debt' | 'spend' | 'scroll' | 'overall';
  text: string;
  certainty: Certainty;
}

export interface ReflectionProvider {
  readonly id: 'local';
  reflect(ctx: PauseContext): Promise<Reflection>;
}
