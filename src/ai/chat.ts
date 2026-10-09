// Ask Ginto: a chat that answers from the user's own records.
// Everything runs on the phone: rules compute the answer, the on-device model phrases it.

import { checkAffordability } from '@/domain/affordability';
import { formatPHP, parsePesoInput } from '@/domain/money';
import { formatMinutes } from '@/domain/scroll';
import type { ChatLogEntry, ChatLogGap } from '@/domain/chatLog';
import type { BudgetProfile } from '@/domain/types';
import type { Overview } from '@/db/repo';

export interface ChatMessage {
  id: string;
  role: 'user' | 'ginto';
  text: string;
  source?: 'local';
  /** Photo the user attached. Kept in memory only and read on the phone. */
  image?: { uri: string; base64: string; mediaType: string };
  /** A log read from this message, waiting for the user to save or cancel it. */
  log?: { entry: ChatLogEntry; taglish: boolean; state: 'pending' | 'saved' | 'cancelled' };
}

/** What Ginto says when a photo cannot be read on this phone. */
export function localImageReply(hasVisionModel = false): string {
  if (hasVisionModel) {
    return 'I couldn’t finish reading this photo on your phone. The model may still be starting, so try again in a moment. If this is a threatening message from a collector, tap "Save as evidence" so it stays safe on your phone, or paste its text in Scan message.';
  }
  return 'To read photos privately on this phone, download Gemma 4 in Ginto’s chat settings (needs a phone with 6 GB+ RAM). If this is a threatening message from a collector, tap "Save as evidence" so it stays safe on your phone, or paste its text in Scan message.';
}

export interface ChatContext {
  name: string;
  budget: BudgetProfile | null;
  overview: Overview;
}

/** A lender name as the user typed it, trimmed so one long entry cannot crowd the prompt. */
const lenderName = (name: string) => name.trim().replace(/\s+/g, ' ').slice(0, 40) || 'unnamed';

/** Most items listed one by one; the totals above them always cover everything. */
const MAX_LISTED = 5;

/** Open debts the user owes, soonest due first. The model runs on the phone, so names stay here. */
function debtLines(o: Overview): string[] {
  const open = o.debts
    .filter((b) => b.debt.direction === 'owed' && b.outstanding > 0)
    .sort((a, b) => (a.debt.dueDate ?? '9999').localeCompare(b.debt.dueDate ?? '9999'));
  return open.slice(0, MAX_LISTED).map(
    (b, i) =>
      `Debt ${i + 1} (${lenderName(b.debt.counterparty)}): ${formatPHP(b.outstanding)} left of ${formatPHP(b.debt.principal)}${
        b.debt.dueDate ? `, due ${b.debt.dueDate}` : ', no due date'
      }.`,
  );
}

/**
 * What the app can do and where, so the model points to a real screen instead of inventing
 * one. Fixed text: it never carries user data.
 */
export const APP_GUIDE = [
  'Unhooked app (only suggest these):',
  '- Today tab: daily summary, check-in (stress, mood, fatigue), Help and safety hotlines.',
  '- Debt tab: add a debt, log payments, repayment plan, Utang Scanner for loan app screenshots, Evidence Pack for collector messages, number log.',
  '- Spend tab: monthly budget, check a purchase before buying, 24-hour cooling off.',
  '- Scroll tab: guard apps and websites, Unhook timer, scroll fade, log scroll sessions.',
  '- Pause button (middle of the bar): a real countdown before buying, borrowing or scrolling.',
  '- Scan a message: check a lender text for warning signs.',
  '- This chat (typed or by voice) can log spending, debt payments, new debts, money lent, scroll time and breaks, e.g. "gumastos ako ng 250 sa pagkain".',
].join('\n');

/** The user's own records for the on-device model: amounts, dates and lender names, never message text or notes. */
export function contextSummary(c: ChatContext): string {
  const o = c.overview;
  const lines = [
    c.budget
      ? `Monthly income ${formatPHP(c.budget.monthlyIncome)}, fixed bills ${formatPHP(c.budget.monthlyFixedBills)}, savings goal ${formatPHP(c.budget.savingsGoalMonthly)}, already spent this month ${formatPHP(o.spentThisMonth)}.`
      : 'No budget set yet.',
    `Owes ${formatPHP(o.owedTotal)} in total across ${o.debts.filter((b) => b.debt.direction === 'owed' && b.outstanding > 0).length} debts; ${formatPHP(o.dueThisMonth)} due by the end of this month.`,
    o.nextDue
      ? `Next due: ${formatPHP(o.nextDue.outstanding)} to ${lenderName(o.nextDue.debt.counterparty)} on ${o.nextDue.debt.dueDate}.`
      : 'No dated repayments.',
    ...debtLines(o),
    `Owed to them by others: ${formatPHP(o.lentTotal)}.`,
    `Purchases cooling off: ${o.cooling.length}${
      o.cooling.length
        ? ` (${o.cooling
            .slice(0, MAX_LISTED)
            .map((p) => formatPHP(p.price))
            .join(', ')})`
        : ''
    }.`,
    `Tracked scrolling today: ${o.scroll.todayMinutes} min; this week: ${o.scroll.weekMinutes} min.`,
    `Pauses where they chose to wait today: ${o.dodgedToday}. Breaks today: ${o.breaksToday}.`,
    `Saved collector messages (Evidence Pack): ${o.evidence.count}.`,
    o.checkIn
      ? `Today's check-in (1-5): stress ${o.checkIn.stress}, mood ${o.checkIn.mood}, fatigue ${o.checkIn.fatigue}.`
      : 'No check-in today.',
  ];
  return lines.join('\n');
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Whole-word matching: "spend it" must not match "end it", "Lazada" must not match "sad".
const has = (t: string, ...words: string[]) =>
  words.some((w) => new RegExp(`(^|[^a-z0-9ñ])${escapeRe(w)}(?![a-z0-9ñ])`, 'i').test(t));

const AMOUNT = /(\d[\d,]*(?:\.\d{1,2})?)\s?(k)?(?![\d,])/i;

export function findAmount(text: string) {
  // Prefer an explicitly marked peso amount ("₱1,500", "PHP 2k", "P500"); else the first number.
  const marked = text.match(new RegExp(`(?:₱|php|\\bp)\\s?${AMOUNT.source}`, 'i'));
  const m = marked ?? text.match(AMOUNT);
  if (!m?.[1]) return null;
  const base = parsePesoInput(m[1]);
  if (base === null) return null;
  return m[2] ? base * 1000 : base;
}

/** Crisis wording always gets the fixed hotline answer; it is never handed to a language model. */
export function isCrisis(input: string): boolean {
  return has(
    input.toLowerCase(),
    'suicide',
    'kill myself',
    'end it',
    'end it all',
    'mamatay',
    'magpakamatay',
    'patayin ko sarili',
    'self-harm',
    'saktan ang sarili',
  );
}

export const CRISIS_REPLY =
  'I am really glad you told me. You deserve support from a real person right now. Please call the NCMH Crisis Hotline at 1553, or 911 if you are in danger.';

const GENERIC_REPLY =
  'I can help with your budget, debts, purchases and scrolling. Try "Can I afford ₱1,500?", "What is due this month?" or "How much did I scroll today?"';

/** On-device answers. Short, warm, and only ever about the user's own numbers. */
export function localReply(input: string, c: ChatContext): string {
  return localReplyOrNull(input, c) ?? GENERIC_REPLY;
}

/** Same as localReply, but null when no intent matched (so a model is not fed the generic help text). */
export function localReplyOrNull(input: string, c: ChatContext): string | null {
  const t = input.toLowerCase();
  const o = c.overview;

  if (isCrisis(input)) return CRISIS_REPLY;
  if (
    has(t, 'stress', 'anxious', 'pagod', 'tired', 'overwhelm', 'sad', 'malungkot', 'kinakabahan')
  ) {
    return 'That sounds heavy. Let us keep today small: one breath, one decision at a time. If money is part of it, I can show you exactly what is due so it feels less foggy. If it feels too much, consider reaching out to someone you trust.';
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

  return null;
}

/** The confirm card for a log read from chat: plain facts, the user taps Save or Cancel. */
export function logPreview(entry: ChatLogEntry, taglish: boolean): string {
  const ask = taglish ? 'I-log ko ba ito?' : 'Log this?';
  switch (entry.kind) {
    case 'spent':
      return `${ask}\n${taglish ? 'Gastos' : 'Spent'}: ${formatPHP(entry.amount)} · ${entry.item} (${entry.isNeed ? 'need' : 'want'})`;
    case 'payment':
      return `${ask}\n${taglish ? 'Bayad' : 'Payment'}: ${formatPHP(entry.amount)} ${taglish ? 'sa' : 'to'} ${entry.lender}`;
    case 'debt':
      return `${ask}\n${
        entry.direction === 'owed'
          ? `${taglish ? 'Utang' : 'Borrowed'}: ${formatPHP(entry.amount)} ${taglish ? 'sa' : 'from'} ${entry.lender}`
          : `${taglish ? 'Pinautang' : 'Lent'}: ${formatPHP(entry.amount)} ${taglish ? 'kay' : 'to'} ${entry.lender}`
      }${entry.dueDate ? ` · due ${entry.dueDate}` : ''}`;
    case 'scroll':
      return `${ask}\nScroll: ${formatMinutes(entry.minutes)} ${taglish ? 'sa' : 'on'} ${entry.app}`;
    case 'break':
      return `${ask}\nBreak: 1`;
  }
}

export function logSavedReply(entry: ChatLogEntry, taglish: boolean): string {
  const where: Record<ChatLogEntry['kind'], string> = {
    spent: 'Spend',
    payment: 'Debt',
    debt: 'Debt',
    scroll: 'Scroll',
    break: 'Today',
  };
  return taglish
    ? `Na-log na. Makikita mo ito sa ${where[entry.kind]} tab.`
    : `Logged. You can see it in the ${where[entry.kind]} tab.`;
}

export function logGapReply(gap: ChatLogGap, taglish: boolean): string {
  if (gap.need === 'amount') {
    return taglish
      ? 'Magkano? Sabihin mo ulit kasama ang halaga, hal. "gumastos ako ng ₱250 sa pagkain".'
      : 'How much? Say it again with the amount, like "spent ₱250 on food".';
  }
  if (gap.need === 'minutes') {
    return taglish
      ? 'Ilang minuto? Hal. "nag-scroll ako ng 30 minutes sa TikTok".'
      : 'How long? Like "scrolled 30 minutes on TikTok".';
  }
  if (gap.lenders?.length) {
    return taglish
      ? `Saang utang ito napunta: ${gap.lenders.join(', ')}? Sabihin mo ulit kasama ang pangalan.`
      : `Which debt was it for: ${gap.lenders.join(', ')}? Say it again with the name.`;
  }
  return taglish
    ? 'Kanino? Sabihin mo ulit kasama ang pangalan, hal. "umutang ako ng ₱2,000 sa GCash".'
    : 'Who with? Say it again with the name, like "borrowed ₱2,000 from GCash".';
}
