import { isValidPlannedDate } from '../purchases';

describe('isValidPlannedDate', () => {
  const today = new Date(2026, 9, 9, 16);

  it('accepts today and later local calendar dates', () => {
    expect(isValidPlannedDate('2026-10-09', today)).toBe(true);
    expect(isValidPlannedDate('2026-10-31', today)).toBe(true);
  });

  it('rejects past, invalid and malformed dates', () => {
    expect(isValidPlannedDate('2026-10-08', today)).toBe(false);
    expect(isValidPlannedDate('2026-02-30', today)).toBe(false);
    expect(isValidPlannedDate('10/10/2026', today)).toBe(false);
  });
});
