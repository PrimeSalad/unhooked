import { dateFromKey, localDateKey } from '../dateOnly';

describe('local calendar dates', () => {
  it('keeps the selected local day instead of converting through UTC', () => {
    expect(localDateKey(new Date(2026, 9, 9, 23, 30))).toBe('2026-10-09');
    expect(localDateKey(dateFromKey('2026-10-09')!)).toBe('2026-10-09');
  });

  it('rejects invalid date keys', () => {
    expect(dateFromKey('2026-02-30')).toBeNull();
    expect(dateFromKey('10/09/2026')).toBeNull();
  });
});
