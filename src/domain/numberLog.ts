// Screenshot text can suggest a number or agent name, but cannot verify who sent a message.
// Only numbers the user explicitly selects become reports in the local log.

import { isValidIncidentDate } from './evidence';
import type { NumberReport } from './types';

const MOBILE = /(^|[^\d])((?:\+?63[\s.-]?|0)?9\d{2}[\s.-]?\d{3}[\s.-]?\d{4})(?!\d)/gm;
const MAX_IMPORT_BYTES = 20_000_000;
const MAX_REPORTS = 5000;

export function normalizeMobile(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  const local =
    digits.length === 12 && digits.startsWith('63')
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith('0')
        ? digits.slice(1)
        : digits;
  return /^9\d{9}$/.test(local) ? `+63${local}` : null;
}

export interface NumberCandidate {
  number: string;
  context: 'possible sender' | 'possible payment number' | 'unclear';
}

export function extractEvidenceContacts(text: string): {
  agentName: string | null;
  numbers: NumberCandidate[];
} {
  const agentLine = text
    .split(/\r?\n/)
    .map((line) =>
      /\b(?:agent|collector|representative)\s*[:\-]\s*([A-Za-z][A-Za-z .'-]{2,60})/i
        .exec(line)?.[1]
        ?.trim(),
    )
    .find((value) => value && /[A-Za-z]+\s+[A-Za-z]+/.test(value));
  const numbers = new Map<string, NumberCandidate>();
  for (const match of text.matchAll(MOBILE)) {
    const number = normalizeMobile(match[2] ?? '');
    if (!number) continue;
    const lineStart = text.lastIndexOf('\n', match.index) + 1;
    const lineEnd = text.indexOf('\n', match.index);
    const line = text.slice(lineStart, lineEnd < 0 ? undefined : lineEnd).toLowerCase();
    const context: NumberCandidate['context'] =
      /\b(gcash|maya|pay|payment|send|transfer|account)\b/i.test(line)
        ? 'possible payment number'
        : /\b(from|sender|agent|collector|contact|mobile|phone)\b/i.test(line)
          ? 'possible sender'
          : 'unclear';
    const previous = numbers.get(number);
    if (!previous || (previous.context === 'unclear' && context !== 'unclear'))
      numbers.set(number, { number, context });
  }
  return { agentName: agentLine ?? null, numbers: [...numbers.values()] };
}

export interface NumberSummary {
  number: string;
  agentName: string | null;
  lastSeenOn: string;
  reports: number;
}

export function summarizeNumbers(reports: NumberReport[]): NumberSummary[] {
  const byNumber = new Map<string, NumberSummary>();
  for (const report of [...reports].sort((a, b) => b.seenOn.localeCompare(a.seenOn))) {
    const current = byNumber.get(report.number);
    if (current) {
      current.reports++;
      if (!current.agentName && report.agentName) current.agentName = report.agentName;
    } else {
      byNumber.set(report.number, {
        number: report.number,
        agentName: report.agentName,
        lastSeenOn: report.seenOn,
        reports: 1,
      });
    }
  }
  return [...byNumber.values()].sort(
    (a, b) => b.lastSeenOn.localeCompare(a.lastSeenOn) || a.number.localeCompare(b.number),
  );
}

export function matchesInText(text: string, summaries: NumberSummary[]): NumberSummary[] {
  const found = new Set(extractEvidenceContacts(text).numbers.map((item) => item.number));
  return summaries.filter((item) => found.has(item.number));
}

export function buildNumberLogFile(reports: NumberReport[], exportedAt = new Date()): string {
  return JSON.stringify(
    { format: 'unhooked-number-log', version: 1, exportedAt: exportedAt.toISOString(), reports },
    null,
    2,
  );
}

/** Strict import validation prevents malformed or huge shared files from changing local records. */
export function parseNumberLogFile(raw: string): NumberReport[] {
  if (raw.length > MAX_IMPORT_BYTES) throw new Error('This log file is too large.');
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('This is not a valid JSON log file.');
  }
  if (!value || typeof value !== 'object') throw new Error('This is not an Unhooked number log.');
  const file = value as Record<string, unknown>;
  if (file.format !== 'unhooked-number-log' || file.version !== 1 || !Array.isArray(file.reports))
    throw new Error('This is not a supported Unhooked number log.');
  if (file.reports.length > MAX_REPORTS) throw new Error('This log has too many reports.');
  const reports: NumberReport[] = [];
  const ids = new Set<string>();
  for (const item of file.reports as unknown[]) {
    if (!item || typeof item !== 'object') throw new Error('This log contains an invalid report.');
    const row = item as Record<string, unknown>;
    if (
      typeof row.id !== 'string' ||
      !/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(row.id) ||
      typeof row.number !== 'string' ||
      normalizeMobile(row.number) !== row.number ||
      typeof row.seenOn !== 'string' ||
      !isValidIncidentDate(row.seenOn) ||
      typeof row.createdAt !== 'string' ||
      row.createdAt.length > 40 ||
      !Number.isFinite(Date.parse(row.createdAt)) ||
      (row.agentName !== null &&
        (typeof row.agentName !== 'string' || row.agentName.length > 80)) ||
      (row.note !== null && (typeof row.note !== 'string' || row.note.length > 500))
    )
      throw new Error('This log contains an invalid report.');
    if (ids.has(row.id)) continue;
    ids.add(row.id);
    reports.push({
      id: row.id,
      number: row.number,
      agentName: row.agentName as string | null,
      seenOn: row.seenOn,
      note: row.note as string | null,
      createdAt: row.createdAt,
    });
  }
  return reports;
}
