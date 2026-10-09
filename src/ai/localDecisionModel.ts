// A tiny, explainable local model for just-in-time interventions.
// It is intentionally not a generative model: finance math remains deterministic,
// while this model combines normalized behavioral signals to rank how much care
// a moment may need. It runs offline and returns its contributing factors.

import type { LocalInference, LocalModelFactor, PauseContext, PressureBand } from './types';
import type { WellnessCheckIn } from '@/domain/types';

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const number = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0;
const sigmoid = (n: number) => 1 / (1 + Math.exp(-n));

interface FeatureInput {
  key: string;
  label: string;
  value: number;
  weight: number;
  available?: boolean;
}

export interface DailyModelInput {
  monthlyIncome: number;
  monthlyFixedBills: number;
  savingsGoalMonthly: number;
  owedTotal: number;
  dueThisMonth: number;
  scrollMinutesToday: number;
  scrollLimitMinutes: number;
  coolingCount: number;
  checkIn: WellnessCheckIn | null;
}

function finalize(features: FeatureInput[], context: 'pause' | 'daily'): LocalInference {
  const available = features.filter((feature) => feature.available !== false);
  const scored = available.map<LocalModelFactor>((feature) => ({
    key: feature.key,
    label: feature.label,
    value: Math.round(clamp01(feature.value) * 100) / 100,
    contribution: Math.round(clamp01(feature.value) * feature.weight * 100) / 100,
  }));
  const logit = -1.55 + scored.reduce((sum, feature) => sum + feature.contribution, 0);
  const score = Math.round(sigmoid(logit) * 100);
  const band: PressureBand = score >= 70 ? 'high' : score >= 40 ? 'watch' : 'steady';
  const factors = scored
    .filter((feature) => feature.contribution >= 0.12)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3);
  const lead = factors[0]?.key;

  const recommendedAction =
    lead === 'scroll_overrun'
      ? 'Take a short break before opening the feed again.'
      : lead === 'repayment_pressure' || lead === 'debt_load'
        ? 'Review the next repayment before adding another commitment.'
        : lead === 'affordability_conflict' || lead === 'purchase_impact'
          ? 'Let the purchase cool for 24 hours, then check it again.'
          : lead === 'stress' || lead === 'fatigue'
            ? 'Keep the next decision small and give it more time.'
            : 'No urgent pattern stands out. Keep using the pause when it helps.';

  const summary =
    band === 'high'
      ? context === 'pause'
        ? 'Several pressure signals are stacking up in this moment.'
        : 'Several pressure signals are stacking up today.'
      : band === 'watch'
        ? 'One pattern is worth a closer look before the next decision.'
        : 'No strong pressure pattern is showing right now.';

  return {
    score,
    band,
    summary,
    recommendedAction,
    factors,
    signalCount: available.length,
    modelVersion: 'ginto-jitai-v1',
  };
}

function wellbeingFeatures(checkIn: WellnessCheckIn | null): FeatureInput[] {
  return [
    {
      key: 'stress',
      label: 'Your optional check-in says today feels stressful',
      value: checkIn ? (checkIn.stress - 1) / 4 : 0,
      weight: 0.58,
      available: !!checkIn,
    },
    {
      key: 'fatigue',
      label: 'Mental fatigue can make fast decisions harder',
      value: checkIn ? (checkIn.fatigue - 1) / 4 : 0,
      weight: 0.42,
      available: !!checkIn,
    },
    {
      key: 'low_mood',
      label: 'Your optional check-in says your mood is low',
      value: checkIn ? (5 - checkIn.mood) / 4 : 0,
      weight: 0.25,
      available: !!checkIn,
    },
  ];
}

/** Inference used during borrowing, checkout and scroll pauses. */
export function inferPausePressure(ctx: PauseContext): LocalInference {
  const facts = ctx.facts;
  const income = number(facts.monthlyIncome);
  const freeMoney = Math.max(
    1,
    income - number(facts.monthlyFixedBills) - number(facts.savingsGoalMonthly),
  );
  const due = number(facts.dueThisMonth);
  const owed = number(facts.owedTotal);
  const price = number(facts.price || facts.amount);
  const shortfall = number(facts.shortfall);
  const verdict = String(facts.verdict ?? '');
  const scrollMinutes = number(facts.scrollMinutes || facts.minutes);
  const scrollLimit = number(facts.scrollLimit);

  return finalize(
    [
      {
        key: 'repayment_pressure',
        label: 'Repayments use a large share of this month’s free money',
        value: due / freeMoney,
        weight: 1.28,
        available: income > 0 && due > 0,
      },
      {
        key: 'debt_load',
        label: 'Existing debt is already significant beside monthly income',
        value: income > 0 ? owed / (income * 1.5) : owed > 0 ? 0.65 : 0,
        weight: 0.82,
        available: owed > 0,
      },
      {
        key: 'affordability_conflict',
        label: 'This choice may clash with a repayment already due',
        value: verdict === 'conflicts' ? 1 : verdict === 'tight' ? 0.58 : 0,
        weight: 1.5,
        available: !!verdict,
      },
      {
        key: 'purchase_impact',
        label: 'This amount takes a large share of the money still available',
        value: price / freeMoney,
        weight: 0.72,
        available: price > 0 && income > 0,
      },
      {
        key: 'shortfall',
        label: 'The estimate leaves part of a repayment uncovered',
        value: price > 0 ? shortfall / price : shortfall > 0 ? 1 : 0,
        weight: 0.92,
        available: shortfall > 0,
      },
      {
        key: 'scroll_overrun',
        label: 'This session has gone past the limit you chose',
        value: scrollLimit > 0 ? (scrollMinutes - scrollLimit) / scrollLimit + 0.5 : 0,
        weight: 1.25,
        available: scrollLimit > 0 && scrollMinutes >= scrollLimit,
      },
      ...wellbeingFeatures(ctx.latestCheckIn),
    ],
    'pause',
  );
}

/** Daily cross-module inference shown in Insights. */
export function inferDailyPressure(input: DailyModelInput): LocalInference {
  const freeMoney = Math.max(
    1,
    input.monthlyIncome - input.monthlyFixedBills - input.savingsGoalMonthly,
  );
  return finalize(
    [
      {
        key: 'repayment_pressure',
        label: 'Repayments use a large share of this month’s free money',
        value: input.dueThisMonth / freeMoney,
        weight: 1.28,
        available: input.monthlyIncome > 0 && input.dueThisMonth > 0,
      },
      {
        key: 'debt_load',
        label: 'Open debt is high beside one month of income',
        value:
          input.monthlyIncome > 0
            ? input.owedTotal / (input.monthlyIncome * 1.5)
            : input.owedTotal > 0
              ? 0.65
              : 0,
        weight: 0.82,
        available: input.owedTotal > 0,
      },
      {
        key: 'scroll_overrun',
        label: 'Tracked scrolling is past the limit you chose',
        value:
          input.scrollLimitMinutes > 0
            ? (input.scrollMinutesToday - input.scrollLimitMinutes) / input.scrollLimitMinutes + 0.5
            : 0,
        weight: 1.25,
        available:
          input.scrollLimitMinutes > 0 && input.scrollMinutesToday >= input.scrollLimitMinutes,
      },
      {
        key: 'decision_load',
        label: 'Several purchases are waiting for a decision',
        value: input.coolingCount / 3,
        weight: 0.35,
        available: input.coolingCount > 0,
      },
      ...wellbeingFeatures(input.checkIn),
    ],
    'daily',
  );
}
