// Rule-based insights from the user's own records. Short, labeled, dismissible.

import type { Overview } from '@/db/repo';
import { formatPHP } from '@/domain/money';
import { formatMinutes } from '@/domain/scroll';
import type { BudgetProfile } from '@/domain/types';

import type { Insight } from './types';

const hourLabel = (h: number) => {
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 === 0 ? 12 : h % 12} ${suffix}`;
};

export function buildInsights(o: Overview): Insight[] {
  const out: Insight[] = [];

  const dueSoon = o.debts.filter(
    (b) => b.debt.direction === 'owed' && b.outstanding > 0 && b.debt.dueDate,
  );
  if (dueSoon.length >= 2) {
    out.push({
      id: 'debt-cluster',
      module: 'debt',
      certainty: 'fact',
      text: `${dueSoon.length} repayments have due dates. Planning them together can make the month lighter.`,
    });
  } else if (o.nextDue) {
    out.push({
      id: 'debt-next',
      module: 'debt',
      certainty: 'fact',
      text: `Next up: ${formatPHP(o.nextDue.outstanding)} to ${o.nextDue.debt.counterparty}.`,
    });
  }

  if (o.cooling.length) {
    out.push({
      id: 'spend-cooling',
      module: 'spend',
      certainty: 'fact',
      text: `${o.cooling.length} ${o.cooling.length === 1 ? 'purchase is' : 'purchases are'} cooling off. Nice pause.`,
    });
  }

  if (o.scroll.weekSessions >= 2 && o.scroll.peakHour !== null) {
    out.push({
      id: 'scroll-peak',
      module: 'scroll',
      certainty: 'estimate',
      text: `Most of your scrolling this week starts around ${hourLabel(o.scroll.peakHour)}. A reminder before then might help.`,
    });
  }
  if (o.scroll.todayMinutes > 0) {
    out.push({
      id: 'scroll-today',
      module: 'scroll',
      certainty: 'fact',
      text: `${formatMinutes(o.scroll.todayMinutes)} of tracked scrolling today, ${o.breaksToday} ${o.breaksToday === 1 ? 'break' : 'breaks'} taken.`,
    });
  }

  if (o.checkIn && o.checkIn.stress >= 4) {
    out.push({
      id: 'overall-stress',
      module: 'overall',
      certainty: 'suggestion',
      text: 'You said today feels stressful. Big money decisions can wait until tomorrow.',
    });
  }
  return out;
}

/** A short local spend read based only on the saved budget and records. */
export function buildSpendInsights(o: Overview, budget: BudgetProfile | null): Insight[] {
  const out: Insight[] = [];

  if (budget) {
    const freeToSpend =
      budget.monthlyIncome -
      budget.monthlyFixedBills -
      budget.savingsGoalMonthly -
      o.spentThisMonth;

    if (freeToSpend < 0) {
      out.push({
        id: 'spend-budget-used',
        module: 'spend',
        certainty: 'estimate',
        text: `With your saved budget and purchases, the free-to-spend estimate is ${formatPHP(-freeToSpend)} below zero this month.`,
      });
    } else if (o.dueThisMonth > 0) {
      const afterRepayments = freeToSpend - o.dueThisMonth;
      out.push({
        id: 'spend-after-repayments',
        module: 'spend',
        certainty: 'estimate',
        text:
          afterRepayments < 0
            ? `Your free-to-spend estimate may fall ${formatPHP(-afterRepayments)} short of repayments currently due this month.`
            : `After repayments currently due this month, about ${formatPHP(afterRepayments)} may remain in your free-to-spend estimate.`,
      });
    }
  }

  if (o.cooling.length > 0) {
    out.push({
      id: 'spend-cooling-suggestion',
      module: 'spend',
      certainty: 'suggestion',
      text: 'Let the cooling-off period finish, then check whether the purchase still fits your month before deciding.',
    });
  } else if (out.length === 0) {
    out.push({
      id: 'spend-check-suggestion',
      module: 'spend',
      certainty: 'suggestion',
      text: budget
        ? 'Check your next purchase to see how its price could change this month’s estimate.'
        : 'Add a monthly budget to get an estimate based on your own spending and repayment records.',
    });
  }

  return out;
}
