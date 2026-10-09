import {
  BREAK_IDEAS,
  elapsedSeconds,
  formatClock,
  formatMinutes,
  partOfDay,
  pickBreakIdea,
  shouldCheckIn,
} from '../scroll';
import type { ScrollSession } from '../types';

const session: ScrollSession = {
  id: 's',
  app: 'TikTok',
  startedAt: '2026-10-09T13:00:00.000Z',
  endedAt: null,
  limitMinutes: 20,
  outcome: null,
};

describe('scroll', () => {
  it('checks in once the limit is reached, not before', () => {
    expect(shouldCheckIn(session, new Date('2026-10-09T13:19:59.000Z'))).toBe(false);
    expect(shouldCheckIn(session, new Date('2026-10-09T13:20:00.000Z'))).toBe(true);
  });

  it('ended sessions never check in and stop counting', () => {
    const ended = { ...session, endedAt: '2026-10-09T13:05:00.000Z' };
    expect(shouldCheckIn(ended, new Date('2026-10-09T14:00:00.000Z'))).toBe(false);
    expect(elapsedSeconds(ended, new Date('2026-10-09T14:00:00.000Z'))).toBe(300);
  });

  it('formats clocks and durations', () => {
    expect(formatClock(1274)).toBe('21:14');
    expect(formatMinutes(52)).toBe('52 min');
    expect(formatMinutes(370)).toBe('6h 10m');
  });
});

describe('pickBreakIdea', () => {
  it('never repeats the last idea', () => {
    for (const idea of BREAK_IDEAS) {
      for (const r of [0, 0.33, 0.66, 0.999]) {
        expect(pickBreakIdea(idea.id, () => r).id).not.toBe(idea.id);
      }
    }
  });

  it('always returns a real idea, even with edge random values', () => {
    expect(BREAK_IDEAS).toContain(pickBreakIdea(null, () => 0));
    expect(BREAK_IDEAS).toContain(pickBreakIdea(null, () => 0.9999));
    expect(BREAK_IDEAS).toContain(pickBreakIdea('not-an-idea', () => 0.5));
  });
});

describe('partOfDay', () => {
  it('buckets local hours into four parts of the day', () => {
    expect(partOfDay(0)).toBe('night');
    expect(partOfDay(5)).toBe('night');
    expect(partOfDay(6)).toBe('morning');
    expect(partOfDay(11)).toBe('morning');
    expect(partOfDay(12)).toBe('afternoon');
    expect(partOfDay(17)).toBe('afternoon');
    expect(partOfDay(18)).toBe('evening');
    expect(partOfDay(23)).toBe('evening');
  });
});
