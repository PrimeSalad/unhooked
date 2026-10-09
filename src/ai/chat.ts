// Ask Ginto: an on-device chat grounded in the user's own records.

import { checkAffordability } from '@/domain/affordability';
import { formatPHP, parsePesoInput } from '@/domain/money';
import { getMonthlyPosition } from '@/domain/monthlyPosition';
import { formatMinutes } from '@/domain/scroll';
import type { BudgetProfile } from '@/domain/types';
import type { Overview } from '@/db/repo';

import { inferDailyPressure } from './localDecisionModel';

export interface ChatMessage {
  id: string;
  role: 'user' | 'ginto';
  text: string;
  source?: 'local';
  /** Photo the user attached. Kept on-device and available to save as evidence. */
  image?: { uri: string };
}

/** What Ginto can say about a photo without the cloud. */
export function localImageReply(): string {
  return 'I cannot read a photo on-device yet. If this is a collector message, save the image as evidence, then paste its text into Scan message for a private warning-sign check.';
}

export interface ChatContext {
  name: string;
  budget: BudgetProfile | null;
  overview: Overview;
  scrollLimitMinutes: number;
}

const has = (t: string, ...words: string[]) => words.some((w) => t.includes(w));

function findAmount(text: string) {
  const m = text.match(/(?:₱|php|p)?\s?(\d[\d,]*(?:\.\d{1,2})?)\s?(k)?/i);
  if (!m?.[1]) return null;
  const base = parsePesoInput(m[1]);
  if (base === null) return null;
  return m[2] ? base * 1000 : base;
}

/** On-device answers. Short, warm, and only ever about the user's own numbers. */
export function localReply(input: string, c: ChatContext): string {
  const t = input.toLowerCase();
  const o = c.overview;

  if (
    has(
      t,
      'suicide',
      'kill myself',
      'end it',
      'mamatay',
      'patayin ko sarili',
      'self-harm',
      'saktan ang sarili',
    )
  ) {
    return 'I am really glad you told me. You deserve support from a real person right now. Please call the NCMH Crisis Hotline at 1553, or call 911 if you are in immediate danger.';
  }
  if (
    has(t, 'stress', 'anxious', 'pagod', 'tired', 'overwhelm', 'sad', 'malungkot', 'kinakabahan')
  ) {
    return 'That sounds heavy. Let us keep today small: one breath, one decision at a time. If money is part of it, I can show you exactly what is due so it feels less foggy.';
  }

  if (
    has(
      t,
      'afford',
      'safe to spend',
      'safely spend',
      'kaya ko',
      'bilhin',
      'buy',
      'bibili',
      'purchase',
    )
  ) {
    const amount = findAmount(input);
    if (!c.budget) {
      return 'I can check that once you add your monthly budget in Spend. It takes about 20 seconds, and it stays on your phone.';
    }
    if (!amount)
      return 'Tell me the price, like "Can I afford ₱2,500?", and I will check it against your budget and repayments.';
    const r = checkAffordability({
      price: amount,
      budget: c.budget,
      upcomingRepayments: o.dueThisMonth,
      spentThisMonth: o.spentThisMonth,
    });
    const left = `about ${formatPHP(r.remainingAfter)} would be left this month`;
    if (r.verdict === 'conflicts') {
      return `Estimate: after ${formatPHP(amount)}, ${left}, which leaves your repayments about ${formatPHP(r.shortfall)} short. Saving it for 24 hours might be kinder to future you.`;
    }
    if (r.verdict === 'tight') {
      return `Estimate: you can, but it gets tight. After ${formatPHP(amount)}, ${left} once repayments are counted. A cheaper option would give you more room.`;
    }
    return `Estimate: looks affordable. After ${formatPHP(amount)}, ${left}. If it still feels right after a short pause, go for it.`;
  }

  if (has(t, 'borrow', 'utang ulit', 'loan', 'mangutang', 'hiram')) {
    return o.owedTotal > 0
      ? `Before borrowing more: you already owe ${formatPHP(o.owedTotal)}, with ${formatPHP(o.dueThisMonth)} due this month. Open Debt → Thinking of borrowing? to compare the new amount with what is already due.`
      : 'You do not owe anything right now. If you need to borrow, check the total repayment and due date first, and only use lenders registered with the SEC.';
  }

  if (has(t, 'owed to me', 'lent', 'pinautang', 'may utang sa akin')) {
    return o.lentTotal > 0
      ? `People owe you ${formatPHP(o.lentTotal)}. In the Debt tab, switch to "Owed to me" to see who and when.`
      : 'Nobody owes you anything right now, based on your records.';
  }

  if (has(t, 'owe', 'utang', 'debt', 'due', 'bayaran', 'repay', 'pay first', 'payment')) {
    if (o.owedTotal === 0)
      return 'You have no open debts recorded. You can add one anytime in the Debt tab.';
    const next = o.nextDue
      ? ` Next up is ${formatPHP(o.nextDue.outstanding)} to ${o.nextDue.debt.counterparty} on ${o.nextDue.debt.dueDate}.`
      : '';
    return `You owe ${formatPHP(o.owedTotal)} in total, ${formatPHP(o.dueThisMonth)} of it due by the end of the month.${next}`;
  }

  if (has(t, 'bnpl', 'installment', 'hulugan', 'pay later', 'paylater')) {
    return 'Pay-later plans often cost more than the price tag. In Spend, enter the installment, number of payments and fees, and I will show the true total and how much extra you pay.';
  }

  if (has(t, 'scroll', 'tiktok', 'facebook', 'phone', 'screen', 'cellphone', 'selpon')) {
    return o.scroll.todayMinutes > 0
      ? `You tracked ${formatMinutes(o.scroll.todayMinutes)} of scrolling today and ${formatMinutes(o.scroll.weekMinutes)} this week. Want a gentler night? Start a session with a limit in Scroll and I will check in when it is up.`
      : 'No scrolling tracked today. When you open a feed, start a session in Scroll and set a limit. I will check in gently when time is up.';
  }

  if (has(t, 'budget', 'income', 'sweldo', 'savings', 'ipon')) {
    if (!c.budget)
      return 'You have not set a budget yet. Add it in Spend so I can check purchases for you.';
    const position = getMonthlyPosition({
      budget: c.budget,
      repayments: o.dueThisMonth,
      spent: o.spentThisMonth,
    });
    return position.repaymentGap > 0
      ? `Estimate: this month is about ${formatPHP(position.repaymentGap)} short of covering recorded repayments after bills, savings and purchases. I would protect the nearest due date before adding new spending.`
      : `Estimate: about ${formatPHP(position.safeToSpend)} is safe to spend after bills, savings, recorded purchases and ${formatPHP(o.dueThisMonth)} in repayments.`;
  }

  if (
    has(
      t,
      'what needs attention',
      'what needs my attention',
      'what should i focus',
      'what do you notice',
      'pressure',
    )
  ) {
    const inference = inferDailyPressure({
      monthlyIncome: c.budget?.monthlyIncome ?? 0,
      monthlyFixedBills: c.budget?.monthlyFixedBills ?? 0,
      savingsGoalMonthly: c.budget?.savingsGoalMonthly ?? 0,
      owedTotal: o.owedTotal,
      dueThisMonth: o.dueThisMonth,
      scrollMinutesToday: o.scroll.todayMinutes,
      scrollLimitMinutes: c.scrollLimitMinutes,
      coolingCount: o.cooling.length,
      checkIn: o.checkIn,
    });
    const factor = inference.factors[0];
    return factor
      ? `My on-device estimate puts today at ${inference.score}/100 for decision pressure. The strongest signal is: ${factor.label.toLowerCase()}. ${inference.recommendedAction}`
      : `My on-device check does not see a strong pressure pattern right now. ${inference.recommendedAction}`;
  }

  if (has(t, 'harass', 'threat', 'banta', 'collector', 'scam', 'message', 'text')) {
    return 'If a collector is threatening you, you do not have to face it alone. Paste the message in Debt → Scan message and I will point out warning signs and help you save it as evidence. You can report abusive lenders to the SEC.';
  }

  if (/\b(hi|hello|hey|kumusta|musta)\b/.test(t)) {
    return `Hi${c.name ? `, ${c.name}` : ''}! I am Ginto. Ask me things like "Can I afford ₱2,000?", "What do I owe?" or "How much did I scroll today?"`;
  }

  return 'I can help with your budget, debts, purchases and scrolling. Try "Can I afford ₱1,500?", "What is due this month?" or "How much did I scroll today?"';
}
