import { buildEventInsights, todayMessage, visibleInsights } from '../insights';
import { summarizeActivity } from '@/domain/activity';
import type { AppEvent, AppEventType } from '@/domain/types';

const now = new Date(2026, 9, 10, 12);
const event = (type: AppEventType, hour: number): AppEvent => ({
  id: `${type}-${hour}`,
  type,
  payload: {},
  createdAt: new Date(2026, 9, 10, hour).toISOString(),
});

describe('Phase 5 event insights', () => {
  it('provides a labeled daily summary and one insight for each module', () => {
    const activity = summarizeActivity(
      [
        event('pause_shown', 8),
        event('purchase_evaluated', 9),
        event('payment_recorded', 10),
        event('break_taken', 11),
      ],
      now,
    );
    const insights = buildEventInsights(activity);

    expect(insights.map((insight) => insight.module)).toEqual([
      'overall',
      'debt',
      'spend',
      'scroll',
    ]);
    expect(insights.every((insight) => insight.certainty === 'fact')).toBe(true);
    expect(insights[0]?.text).toContain('1 pause, 1 purchase reviewed, and 1 break');
    expect(todayMessage(activity.today)).toEqual({
      certainty: 'fact',
      text: 'You made time for 1 break today.',
    });
  });

  it('uses gentle suggestions when there is no activity and filters hidden cards', () => {
    const activity = summarizeActivity([], now);
    const insights = buildEventInsights(activity);
    const visible = visibleInsights(insights, new Set(['week-debt-start']));

    expect(insights.every((insight) => insight.certainty === 'suggestion')).toBe(true);
    expect(visible.some((insight) => insight.module === 'debt')).toBe(false);
    expect(todayMessage(activity.today).text).toMatch(/whenever it helps you/);
  });
});
