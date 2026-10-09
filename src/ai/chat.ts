// Ask Ginto: a chat that answers from the user's own records.
// Default: on-device rules (offline, private). Optional: Claude through the project's proxy
// (server/ginto-proxy.mjs), only when the user turns on cloud AI in Settings.

import { checkAffordability } from '@/domain/affordability';
import { formatPHP, parsePesoInput } from '@/domain/money';
import { formatMinutes } from '@/domain/scroll';
import type { BudgetProfile } from '@/domain/types';
import type { Overview } from '@/db/repo';

export interface ChatMessage {
  id: string;
  role: 'user' | 'ginto';
  text: string;
  source?: 'local' | 'cloud';
  /** Photo the user attached. Kept in memory only; sent to Claude only with cloud AI on. */
  image?: { uri: string; base64: string; mediaType: string };
}

/** What Ginto can say about a photo without the cloud. */
export function localImageReply(): string {
  return 'I can only read photos with Smarter Ask Ginto turned on. If this is a threatening message from a collector, tap "Save as evidence" so it stays safe on your phone, or paste its text in Scan message.';
}

export interface ChatContext {
  name: string;
  budget: BudgetProfile | null;
  overview: Overview;
}

/** Numbers only: no names of lenders, no message text, no screenshots leave the phone. */
export function contextSummary(c: ChatContext): string {
  const o = c.overview;
  const lines = [
    c.budget
      ? `Monthly income ${formatPHP(c.budget.monthlyIncome)}, fixed bills ${formatPHP(c.budget.monthlyFixedBills)}, savings goal ${formatPHP(c.budget.savingsGoalMonthly)}, already spent this month ${formatPHP(o.spentThisMonth)}.`
      : 'No budget set yet.',
    `Owes ${formatPHP(o.owedTotal)} in total across ${o.debts.filter((b) => b.debt.direction === 'owed' && b.outstanding > 0).length} debts; ${formatPHP(o.dueThisMonth)} due by the end of this month.`,
    o.nextDue
      ? `Next due: ${formatPHP(o.nextDue.outstanding)} on ${o.nextDue.debt.dueDate}.`
      : 'No dated repayments.',
    `Owed to them by others: ${formatPHP(o.lentTotal)}.`,
    `Purchases cooling off: ${o.cooling.length}.`,
    `Tracked scrolling today: ${o.scroll.todayMinutes} min; this week: ${o.scroll.weekMinutes} min.`,
    `Pauses where they chose to wait today: ${o.dodgedToday}. Breaks today: ${o.breaksToday}.`,
    o.checkIn
      ? `Today's check-in (1-5): stress ${o.checkIn.stress}, mood ${o.checkIn.mood}, fatigue ${o.checkIn.fatigue}.`
      : 'No check-in today.',
  ];
  return lines.join('\n');
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
    return 'I am really glad you told me. You deserve support from a real person right now. Please call the NCMH Crisis Hotline at 1553, or 911 if you are in danger. You can also open Help and safety from the Today screen.';
  }
  if (
    has(t, 'stress', 'anxious', 'pagod', 'tired', 'overwhelm', 'sad', 'malungkot', 'kinakabahan')
  ) {
    return 'That sounds heavy. Let us keep today small: one breath, one decision at a time. If money is part of it, I can show you exactly what is due so it feels less foggy. And if it gets too much, Help and safety has people you can call.';
  }

  if (has(t, 'afford', 'kaya ko', 'bilhin', 'buy', 'bibili', 'purchase')) {
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
      ? `Before borrowing more: you already owe ${formatPHP(o.owedTotal)}, with ${formatPHP(o.dueThisMonth)} due this month. Tap the pause button in the middle of the bar and choose "I want to borrow" so we can look at it together.`
      : 'You do not owe anything right now. If you need to borrow, check the total repayment and due date first, and only use lenders registered with the SEC.';
  }

  if (has(t, 'owe', 'utang', 'debt', 'due', 'bayaran', 'repay')) {
    if (o.owedTotal === 0)
      return 'You have no open debts recorded. You can add one anytime in the Debt tab.';
    const next = o.nextDue
      ? ` Next up is ${formatPHP(o.nextDue.outstanding)} to ${o.nextDue.debt.counterparty} on ${o.nextDue.debt.dueDate}.`
      : '';
    return `You owe ${formatPHP(o.owedTotal)} in total, ${formatPHP(o.dueThisMonth)} of it due by the end of the month.${next}`;
  }

  if (has(t, 'owed to me', 'lent', 'pinautang', 'may utang sa akin')) {
    return o.lentTotal > 0
      ? `People owe you ${formatPHP(o.lentTotal)}. In the Debt tab, switch to "Owed to me" to see who and when.`
      : 'Nobody owes you anything right now, based on your records.';
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
    const free =
      c.budget.monthlyIncome -
      c.budget.monthlyFixedBills -
      c.budget.savingsGoalMonthly -
      o.spentThisMonth;
    return `Estimate: after bills, savings and what you already bought this month, about ${formatPHP(free)} is free to spend, before ${formatPHP(o.dueThisMonth)} in repayments.`;
  }

  if (has(t, 'harass', 'threat', 'banta', 'collector', 'scam', 'message', 'text')) {
    return 'If a collector is threatening you, you do not have to face it alone. Paste the message in Debt → Scan message and I will point out warning signs and help you save it as evidence. You can report abusive lenders to the SEC.';
  }

  if (/\b(hi|hello|hey|kumusta|musta)\b/.test(t)) {
    return `Hi${c.name ? `, ${c.name}` : ''}! I am Ginto. Ask me things like "Can I afford ₱2,000?", "What do I owe?" or "How much did I scroll today?"`;
  }

  return 'I can help with your budget, debts, purchases and scrolling. Try "Can I afford ₱1,500?", "What is due this month?" or "How much did I scroll today?"';
}

export const CLOUD_URL = process.env.EXPO_PUBLIC_GINTO_API_URL ?? '';

export async function cloudReply(history: ChatMessage[], c: ChatContext): Promise<string> {
  const res = await fetch(`${CLOUD_URL.replace(/\/$/, '')}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      context: contextSummary(c),
      // Only the newest photo travels; older turns go as text to keep requests small.
      messages: history.map((m, i) => {
        const latestImage = m.image && history.slice(i + 1).every((n) => !n.image);
        return {
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.text,
          ...(latestImage && m.image
            ? { image: { mediaType: m.image.mediaType, data: m.image.base64 } }
            : {}),
        };
      }),
    }),
  });
  if (!res.ok) throw new Error(`Ginto server error ${res.status}`);
  const data = (await res.json()) as { reply?: string };
  if (!data.reply) throw new Error('Empty reply');
  return data.reply;
}
