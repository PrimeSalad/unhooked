import { summarizeActivity } from '../activity';
import type { AppEvent, AppEventType } from '../types';

const event = (type: AppEventType, at: Date, payload: Record<string, unknown> = {}): AppEvent => ({
  id: `${type}-${at.getTime()}`,
  type,
  payload,
  createdAt: at.toISOString(),
});

describe('summarizeActivity', () => {
  const now = new Date(2026, 9, 10, 12);

  it('counts local today and the last seven calendar days from the event log', () => {
    const activity = summarizeActivity(
      [
        event('pause_shown', new Date(2026, 9, 10, 9)),
        event('pause_decision', new Date(2026, 9, 10, 9, 1)),
        event('purchase_evaluated', new Date(2026, 9, 10, 10)),
        event('break_taken', new Date(2026, 9, 9, 22)),
        event('payment_recorded', new Date(2026, 9, 4, 0)),
        event('debt_added', new Date(2026, 9, 3, 23, 59)),
      ],
      now,
    );

    expect(activity.todayKey).toBe('2026-10-10');
    expect(activity.today).toMatchObject({ pauses: 1, purchasesReviewed: 1, breaks: 0 });
    expect(activity.week).toMatchObject({
      pauses: 1,
      purchasesReviewed: 1,
      breaks: 1,
      paymentsRecorded: 1,
      debtsAdded: 0,
    });
  });

  it('hides a dismissed insight for seven full days, then allows it back', () => {
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const active = event('insight_dismissed', new Date(now.getTime() - sevenDays + 1000), {
      id: 'week-debt-payments',
    });
    const expired = event('insight_dismissed', new Date(now.getTime() - sevenDays), {
      id: 'week-spend-reviewed',
    });
    const malformed = event('insight_dismissed', new Date(now.getTime() - 1000), { id: 3 });
    const activity = summarizeActivity([active, expired, malformed], now);

    expect(activity.dismissedIds.has('week-debt-payments')).toBe(true);
    expect(activity.dismissedIds.has('week-spend-reviewed')).toBe(false);
    expect(activity.dismissedIds.size).toBe(1);
  });
});
