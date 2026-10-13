import { formatRemaining, trialStatus } from '../trial';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

describe('trialStatus', () => {
  const installedAt = Date.UTC(2026, 9, 13, 8);
  const farHardExpiry = installedAt + 30 * DAY;

  it('is active right after install with the full window left', () => {
    const s = trialStatus(installedAt, installedAt, 2, farHardExpiry);
    expect(s.expired).toBe(false);
    expect(s.remainingMs).toBe(2 * DAY);
    expect(s.endsAt).toBe(installedAt + 2 * DAY);
  });

  it('counts down and expires exactly at install + days', () => {
    expect(trialStatus(installedAt, installedAt + DAY, 2, farHardExpiry).remainingMs).toBe(DAY);
    expect(trialStatus(installedAt, installedAt + 2 * DAY - 1, 2, farHardExpiry).expired).toBe(
      false,
    );
    expect(trialStatus(installedAt, installedAt + 2 * DAY, 2, farHardExpiry).expired).toBe(true);
    expect(trialStatus(installedAt, installedAt + 5 * DAY, 2, farHardExpiry).remainingMs).toBe(0);
  });

  it('is capped by the hard expiry so a reinstall cannot restart the clock past it', () => {
    const hard = installedAt + 6 * HOUR;
    const s = trialStatus(installedAt, installedAt, 2, hard);
    expect(s.endsAt).toBe(hard);
    expect(s.remainingMs).toBe(6 * HOUR);
    expect(trialStatus(installedAt, hard, 2, hard).expired).toBe(true);
    // Installed after the hard expiry: expired immediately.
    expect(trialStatus(hard + DAY, hard + DAY, 2, hard).expired).toBe(true);
  });

  it('treats a clock rolled back before the install as expired', () => {
    expect(trialStatus(installedAt, installedAt - 30 * 60 * 1000, 2, farHardExpiry).expired).toBe(
      false,
    );
    expect(trialStatus(installedAt, installedAt - 2 * HOUR, 2, farHardExpiry).expired).toBe(true);
  });

  it('treats a clock rolled back before the last open as expired', () => {
    const lastSeen = installedAt + 40 * HOUR;
    // Setting the date back to "day one" after 40 hours of use does not buy more time.
    expect(trialStatus(installedAt, installedAt + HOUR, 2, farHardExpiry, lastSeen).expired).toBe(
      true,
    );
    expect(
      trialStatus(installedAt, lastSeen - 30 * 60 * 1000, 2, farHardExpiry, lastSeen).expired,
    ).toBe(false);
  });
});

describe('formatRemaining', () => {
  it('reads naturally at each scale', () => {
    expect(formatRemaining(30_000)).toBe('less than a minute');
    expect(formatRemaining(12 * 60_000)).toBe('12 min');
    expect(formatRemaining(3 * HOUR + 20 * 60_000)).toBe('3 h 20 min');
    expect(formatRemaining(3 * HOUR)).toBe('3 h');
    expect(formatRemaining(DAY + 4 * HOUR)).toBe('1 day 4 h');
    expect(formatRemaining(2 * DAY)).toBe('2 days');
  });
});
