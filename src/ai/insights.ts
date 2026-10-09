// Rule-based insights from the user's own records. Short, labeled, dismissible.

import type { Overview } from '@/db/repo';
import type { ActivityCounts, ActivitySnapshot } from '@/domain/activity';
import { formatPHP } from '@/domain/money';
import { formatMinutes } from '@/domain/scroll';
import type { BudgetProfile } from '@/domain/types';

import type { Insight } from './types';

const hourLabel = (h: number) => {
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 === 0 ? 12 : h % 12} ${suffix}`;
};

const counted = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Event-log insights always provide a daily summary and one card for each module. */
export function buildEventInsights({ today, week, todayKey }: ActivitySnapshot): Insight[] {
  const didSomething = today.pauses + today.purchasesReviewed + today.breaks > 0;
  const daily: Insight = {
    id: `daily-${todayKey}`,
    module: 'overall',
    certainty: didSomething ? 'fact' : 'suggestion',
    text: didSomething
      ? `Today: ${counted(today.pauses, 'pause')}, ${counted(today.purchasesReviewed, 'purchase')} reviewed, and ${counted(today.breaks, 'break')}.`
      : 'Start with any check that helps you today.',
  };

  const debt: Insight = week.paymentsRecorded
    ? {
        id: 'week-debt-payments',
        module: 'debt',
        certainty: 'fact',
        text: `You recorded ${counted(week.paymentsRecorded, 'payment')} in Debt this week.`,
      }
    : week.debtsAdded
      ? {
          id: 'week-debt-added',
          module: 'debt',
          certainty: 'fact',
          text: `You added ${counted(week.debtsAdded, 'debt')} to your records this week.`,
        }
      : week.repaymentPlansViewed
        ? {
            id: 'week-debt-plan',
            module: 'debt',
            certainty: 'fact',
            text: 'You looked at a repayment plan this week.',
          }
        : {
            id: 'week-debt-start',
            module: 'debt',
            certainty: 'suggestion',
            text: 'Review what you owe or record a payment whenever it helps you plan.',
          };

  const spend: Insight = week.purchasesReviewed
    ? {
        id: 'week-spend-reviewed',
        module: 'spend',
        certainty: 'fact',
        text: `You reviewed ${counted(week.purchasesReviewed, 'purchase')} this week.`,
      }
    : week.purchasesSaved
      ? {
          id: 'week-spend-saved',
          module: 'spend',
          certainty: 'fact',
          text: `You saved ${counted(week.purchasesSaved, 'purchase')} for later this week.`,
        }
      : week.bnplChecks
        ? {
            id: 'week-spend-bnpl',
            module: 'spend',
            certainty: 'fact',
            text: `You checked the full cost of ${counted(week.bnplChecks, 'installment plan')} this week.`,
          }
        : {
            id: 'week-spend-start',
            module: 'spend',
            certainty: 'suggestion',
            text: 'Check a purchase when you want to see how its price fits your month.',
          };

  const scroll: Insight = week.breaks
    ? {
        id: 'week-scroll-breaks',
        module: 'scroll',
        certainty: 'fact',
        text: `You took ${counted(week.breaks, 'break')} from scrolling this week.`,
      }
    : week.scrollCheckIns
      ? {
          id: 'week-scroll-checkins',
          module: 'scroll',
          certainty: 'fact',
          text: `You answered ${counted(week.scrollCheckIns, 'scroll check-in')} this week.`,
        }
      : week.scrollSessions
        ? {
            id: 'week-scroll-sessions',
            module: 'scroll',
            certainty: 'fact',
            text: `You tracked ${counted(week.scrollSessions, 'scroll session')} this week.`,
          }
        : {
            id: 'week-scroll-start',
            module: 'scroll',
            certainty: 'suggestion',
            text: 'A scroll timer can give you a moment to check how you want to spend your time.',
          };

  return [daily, debt, spend, scroll];
}

/** An encouraging Today line whose label still matches the type of statement. */
export function todayMessage(today: ActivityCounts): Pick<Insight, 'text' | 'certainty'> {
  if (today.breaks) {
    return {
      certainty: 'fact',
      text: `You made time for ${counted(today.breaks, 'break')} today.`,
    };
  }
  if (today.pauses) {
    return {
      certainty: 'fact',
      text: `You opened ${counted(today.pauses, 'pause')} today.`,
    };
  }
  if (today.purchasesReviewed) {
    return {
      certainty: 'fact',
      text: `You reviewed ${counted(today.purchasesReviewed, 'purchase')} today.`,
    };
  }
  return { certainty: 'suggestion', text: 'Start with one small check whenever it helps you.' };
}

export function visibleInsights(insights: Insight[], dismissedIds: Set<string>): Insight[] {
  return insights.filter((insight) => !dismissedIds.has(insight.id));
}

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
      text: `Your records show ${counted(dueSoon.length, 'repayment')} with due dates.`,
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
      text: `${o.cooling.length} ${o.cooling.length === 1 ? 'purchase is' : 'purchases are'} cooling off.`,
    });
  }

  if (o.scroll.weekSessions >= 2 && o.scroll.peakHour !== null) {
    out.push({
      id: 'scroll-peak',
      module: 'scroll',
      certainty: 'estimate',
      text: `Most of your tracked scrolling this week starts around ${hourLabel(o.scroll.peakHour)}.`,
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
      text: 'If today feels stressful, consider waiting before a big money decision.',
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
