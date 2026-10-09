import { elapsedSeconds, formatClock, formatMinutes, shouldCheckIn } from '../scroll';
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
