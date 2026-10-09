import { buildEvidencePdfHtml, isValidIncidentDate } from '../evidence';
import type { Evidence } from '../types';

const evidence: Evidence = {
  id: 'one',
  debtId: null,
  lender: '<Collector>',
  agentName: '<Agent>',
  incidentDate: '2026-10-09',
  imageUri: null,
  messageText: '<script>alert(1)</script>',
  riskLevel: 'high',
  note: 'Called & threatened',
  createdAt: '2026-10-09T00:00:00.000Z',
};

it('validates real calendar dates', () => {
  expect(isValidIncidentDate('2026-10-09')).toBe(true);
  expect(isValidIncidentDate('2026-02-30')).toBe(false);
  expect(isValidIncidentDate('tomorrow')).toBe(false);
});

it('includes a cover disclaimer and safely escapes saved text', () => {
  const html = buildEvidencePdfHtml([{ evidence, imageDataUri: null }], new Date('2026-10-10'));
  expect(html).toContain('Incident dates: 2026-10-09 to 2026-10-09');
  expect(html).toContain('not a legal finding');
  expect(html).toContain('&lt;Collector&gt;');
  expect(html).toContain('&lt;Agent&gt;');
  expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  expect(html).not.toContain('<script>');
  expect(html).toContain('Called &amp; threatened');
});
