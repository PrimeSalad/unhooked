import { formatSchedule, isGuardActive, matchesDomain, normalizeDomain } from '../blocking';

describe('normalizeDomain', () => {
  it.each([
    ['https://www.TikTok.com/@x?y=1', 'tiktok.com'],
    ['m.facebook.com', 'facebook.com'],
    ['shopee.ph/', 'shopee.ph'],
    ['http://user@lazada.com.ph:8080/cart', 'lazada.com.ph'],
    ['  YouTube.com.  ', 'youtube.com'],
  ])('%s → %s', (input, out) => {
    expect(normalizeDomain(input)).toEqual({ ok: true, domain: out });
  });

  it.each(['', '192.168.1.1', 'localhost', 'not a site', 'sec.gov.ph'])('rejects %p', (input) => {
    expect(normalizeDomain(input).ok).toBe(false);
  });
});

describe('matchesDomain', () => {
  it('covers subdomains but not look-alikes', () => {
    expect(matchesDomain('vt.tiktok.com', ['tiktok.com'])).toBe(true);
    expect(matchesDomain('tiktok.com', ['tiktok.com'])).toBe(true);
    expect(matchesDomain('nottiktok.com', ['tiktok.com'])).toBe(false);
  });
});

describe('isGuardActive', () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 9, h, m);
  const night = { enabled: true, schedule: { start: 22 * 60, end: 6 * 60 } };

  it('handles windows that cross midnight', () => {
    expect(isGuardActive(night, at(23))).toBe(true);
    expect(isGuardActive(night, at(3))).toBe(true);
    expect(isGuardActive(night, at(6))).toBe(false);
    expect(isGuardActive(night, at(12))).toBe(false);
  });

  it('always-on and disabled rules', () => {
    expect(isGuardActive({ enabled: true, schedule: null }, at(12))).toBe(true);
    expect(isGuardActive({ enabled: false, schedule: null }, at(12))).toBe(false);
  });

  it('formats schedules', () => {
    expect(formatSchedule(night.schedule)).toBe('10:00 PM – 6:00 AM');
    expect(formatSchedule(null)).toBe('All day');
  });
});
