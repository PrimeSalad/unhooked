import {
  callReasons,
  lookupNumber,
  outsideCollectionHours,
  parseScreenedCalls,
  screenList,
  screenedCallNote,
  toggleBlocked,
  type ScreenedCall,
} from '../callScreen';
import type { NumberSummary } from '../numberLog';

const summaries: NumberSummary[] = [
  { number: '+639171234567', agentName: 'Agent Ramos', lastSeenOn: '2026-10-09', reports: 3 },
  { number: '+639281112222', agentName: null, lastSeenOn: '2026-10-01', reports: 1 },
];

const call = (overrides: Partial<ScreenedCall> = {}): ScreenedCall => ({
  number: '+639171234567',
  label: 'Agent Ramos',
  reports: 3,
  blocked: false,
  callsLastHour: 1,
  at: new Date(2026, 9, 10, 14, 15).toISOString(),
  action: 'silence',
  ...overrides,
});

describe('screenList', () => {
  it('labels each reported number for the native service', () => {
    expect(screenList(summaries)).toEqual([
      { number: '+639171234567', label: 'Agent Ramos', reports: 3, block: false },
      { number: '+639281112222', label: 'Reported number', reports: 1, block: false },
    ]);
  });

  it('marks blocked numbers, including ones not in the log', () => {
    expect(screenList(summaries, ['+639171234567', '+639990001111'])).toEqual([
      { number: '+639171234567', label: 'Agent Ramos', reports: 3, block: true },
      { number: '+639281112222', label: 'Reported number', reports: 1, block: false },
      { number: '+639990001111', label: 'Blocked number', reports: 0, block: true },
    ]);
  });
});

describe('toggleBlocked', () => {
  it('blocks and unblocks a number in any common format', () => {
    const blocked = toggleBlocked([], '0917 123 4567');
    expect(blocked).toEqual(['+639171234567']);
    expect(toggleBlocked(blocked, '+63 917 123 4567')).toEqual([]);
    expect(toggleBlocked(blocked, '12345')).toBe(blocked);
  });
});

describe('outsideCollectionHours', () => {
  it('flags calls before 6 AM and from 10 PM', () => {
    expect(outsideCollectionHours(new Date(2026, 9, 10, 5, 59))).toBe(true);
    expect(outsideCollectionHours(new Date(2026, 9, 10, 6, 0))).toBe(false);
    expect(outsideCollectionHours(new Date(2026, 9, 10, 21, 59))).toBe(false);
    expect(outsideCollectionHours(new Date(2026, 9, 10, 22, 0))).toBe(true);
  });
});

describe('callReasons', () => {
  it('lists why a call was flagged, strongest first', () => {
    expect(
      callReasons(call({ callsLastHour: 4, at: new Date(2026, 9, 10, 23, 5).toISOString() })),
    ).toEqual(['In your number log (3×)', '4 calls in an hour', 'Before 6 AM or after 10 PM']);
    expect(callReasons(call({ label: null, reports: 0, callsLastHour: 3 }))).toEqual([
      '3 calls in an hour',
    ]);
    expect(callReasons(call({ blocked: true, reports: 0 }))).toEqual(['Blocked by you']);
  });
});

describe('screenedCallNote', () => {
  it('records the call and how it was handled', () => {
    const note = screenedCallNote(call());
    expect(note).toMatch(/\+639171234567 \(Agent Ramos\)/);
    expect(note).toMatch(/silenced by Unhooked/);
    expect(note).toMatch(/3 reports/);
    expect(note).not.toMatch(/SEC/);
  });

  it('notes a possible SEC hours violation with its exceptions, never as a verdict', () => {
    const note = screenedCallNote(call({ at: new Date(2026, 9, 10, 23, 0).toISOString() }));
    expect(note).toMatch(/SEC Memorandum Circular No\. 18/);
    expect(note).toMatch(/may be/);
    expect(note).toMatch(/15 days past due/);
  });
});

describe('lookupNumber', () => {
  it('finds a reported number in any common format', () => {
    expect(lookupNumber('0917 123 4567', summaries)).toMatchObject({
      kind: 'reported',
      summary: { reports: 3 },
    });
    expect(lookupNumber('+63 917-123-4567', summaries).kind).toBe('reported');
  });

  it('says when a number is new or not a mobile number', () => {
    expect(lookupNumber('09990001111', summaries)).toEqual({
      kind: 'unknown',
      number: '+639990001111',
    });
    expect(lookupNumber('12345', summaries)).toEqual({ kind: 'invalid' });
  });
});

describe('parseScreenedCalls', () => {
  it('keeps well-formed calls and drops the rest', () => {
    const good = {
      number: '+639171234567',
      label: 'Agent Ramos',
      reports: 3,
      blocked: true,
      callsLastHour: 2,
      at: '2026-10-10T14:00:00Z',
      action: 'reject',
    };
    const raw = JSON.stringify([
      good,
      { number: '+639171234567', at: 'not a date', action: 'reject' },
      { number: '+639171234567', at: '2026-10-10T14:00:00Z', action: 'explode' },
      { number: 42 },
    ]);
    expect(parseScreenedCalls(raw)).toEqual([good]);
    expect(parseScreenedCalls('oops')).toEqual([]);
    expect(parseScreenedCalls(null)).toEqual([]);
  });
});
