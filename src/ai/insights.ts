// Rule-based insights from the user's own records. Short, labeled, dismissible.

import type { Overview } from '@/db/repo';
import { formatPHP } from '@/domain/money';
import { formatMinutes } from '@/domain/scroll';

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
