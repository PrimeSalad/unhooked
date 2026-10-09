// Pure event-log summaries for Today and Insights. Local calendar days match the UI.

import type { AppEvent, AppEventType } from './types';

export interface ActivityCounts {
  pauses: number;
  purchasesReviewed: number;
  breaks: number;
  debtsAdded: number;
  paymentsRecorded: number;
  repaymentPlansViewed: number;
  purchasesSaved: number;
  bnplChecks: number;
  scrollSessions: number;
  scrollCheckIns: number;
}

export interface ActivitySnapshot {
  today: ActivityCounts;
  week: ActivityCounts;
  todayKey: string;
  dismissedIds: Set<string>;
}

const emptyCounts = (): ActivityCounts => ({
  pauses: 0,
  purchasesReviewed: 0,
  breaks: 0,
  debtsAdded: 0,
  paymentsRecorded: 0,
  repaymentPlansViewed: 0,
  purchasesSaved: 0,
  bnplChecks: 0,
  scrollSessions: 0,
  scrollCheckIns: 0,
});

const countEvent = (counts: ActivityCounts, type: AppEventType) => {
  switch (type) {
    case 'pause_shown':
      counts.pauses++;
      break;
    case 'purchase_evaluated':
      counts.purchasesReviewed++;
      break;
    case 'break_taken':
      counts.breaks++;
      break;
    case 'debt_added':
      counts.debtsAdded++;
      break;
    case 'payment_recorded':
      counts.paymentsRecorded++;
      break;
    case 'repayment_plan_viewed':
      counts.repaymentPlansViewed++;
      break;
    case 'purchase_saved_for_later':
      counts.purchasesSaved++;
      break;
    case 'bnpl_calculated':
      counts.bnplChecks++;
      break;
    case 'scroll_session_started':
      counts.scrollSessions++;
      break;
    case 'scroll_checkin_answered':
      counts.scrollCheckIns++;
      break;
  }
};

/** Uses midnight in the user's time zone and expires dismissals after seven full days. */
export function summarizeActivity(events: AppEvent[], now = new Date()): ActivitySnapshot {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);
  const dismissalCutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const today = emptyCounts();
  const week = emptyCounts();
  const dismissedIds = new Set<string>();

  for (const event of events) {
    const at = Date.parse(event.createdAt);
    if (!Number.isFinite(at) || at > now.getTime()) continue;
    if (event.type === 'insight_dismissed' && at > dismissalCutoff) {
      const id = event.payload.id;
      if (typeof id === 'string') dismissedIds.add(id);
    }
    if (at >= weekStart.getTime()) countEvent(week, event.type);
    if (at >= todayStart.getTime()) countEvent(today, event.type);
  }

  const todayKey = [
    todayStart.getFullYear(),
    String(todayStart.getMonth() + 1).padStart(2, '0'),
    String(todayStart.getDate()).padStart(2, '0'),
  ].join('-');
  return { today, week, todayKey, dismissedIds };
}
