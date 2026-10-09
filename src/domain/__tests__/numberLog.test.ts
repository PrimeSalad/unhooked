import {
  buildNumberLogFile,
  extractEvidenceContacts,
  matchesInText,
  normalizeMobile,
  parseNumberLogFile,
  summarizeNumbers,
} from '../numberLog';
import type { NumberReport } from '../types';

const report = (
  id: string,
  number: string,
  seenOn: string,
  agentName: string | null = null,
): NumberReport => ({
  id,
  number,
  seenOn,
  agentName,
  note: null,
  createdAt: `${seenOn}T12:00:00.000Z`,
});

test('normalizes Philippine mobile numbers without accepting longer account numbers', () => {
  expect(normalizeMobile('0917 123 4567')).toBe('+639171234567');
  expect(normalizeMobile('+63-917-123-4567')).toBe('+639171234567');
  expect(normalizeMobile('639171234567')).toBe('+639171234567');
  expect(normalizeMobile('12345678901234')).toBeNull();
});

test('OCR suggestions distinguish agent labels and possible payment numbers', () => {
  const found = extractEvidenceContacts(
    'Agent: Maria Santos\nSender 0917 123 4567\nSend to GCash +63 918 765 4321',
  );
  expect(found.agentName).toBe('Maria Santos');
  expect(found.numbers).toEqual([
    { number: '+639171234567', context: 'possible sender' },
    { number: '+639187654321', context: 'possible payment number' },
  ]);
});

test('recent reports merge by normalized number and match a new message without asserting identity', () => {
  const summaries = summarizeNumbers([
    report('00000000-0000-4000-8000-000000000001', '+639171234567', '2026-10-07', 'Maria'),
    report('00000000-0000-4000-8000-000000000002', '+639171234567', '2026-10-10'),
    report('00000000-0000-4000-8000-000000000003', '+639187654321', '2026-10-09'),
  ]);
  expect(summaries[0]).toEqual({
    number: '+639171234567',
    agentName: 'Maria',
    lastSeenOn: '2026-10-10',
    reports: 2,
  });
  expect(matchesInText('Text me at 0917-123-4567.', summaries)).toEqual([summaries[0]]);
});

test('phone-to-phone JSON transfer keeps IDs and rejects malformed records', () => {
  const saved = [report('00000000-0000-4000-8000-000000000001', '+639171234567', '2026-10-10')];
  expect(parseNumberLogFile(buildNumberLogFile(saved))).toEqual(saved);
  expect(parseNumberLogFile(buildNumberLogFile([...saved, ...saved]))).toEqual(saved);
  expect(() => parseNumberLogFile('{bad')).toThrow('valid JSON');
  expect(() =>
    parseNumberLogFile(
      JSON.stringify({
        format: 'unhooked-number-log',
        version: 1,
        reports: [{ ...saved[0], number: '1234' }],
      }),
    ),
  ).toThrow('invalid report');
});
