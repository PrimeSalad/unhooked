// Collector call screening. While the phone rings, the native service checks only the number:
// is it in the user's own number log, has it called again and again, is it a late call.
// No server, no crowd list, no call audio, no model. This file holds the same rules for the
// app side (reasons shown, evidence note) and is the reference for the Kotlin service.
// Pure TS: no React, Expo or native imports.

import { normalizeMobile, type NumberSummary } from './numberLog';

export type CallScreenMode = 'off' | 'notify' | 'silence' | 'reject';

/** Calls from one number within an hour that make it worth flagging even if not in the log. */
export const REPEAT_CALLS = 3;

/** What the native screening service needs per number; synced from the number log. */
export interface ScreenEntry {
  number: string; // +639XXXXXXXXX
  label: string; // agent name, "Reported number" or "Blocked number"
  reports: number;
  block: boolean; // the user blocked it: always declined while screening is on
}

/** A flagged call the service hands back to the app. */
export interface ScreenedCall {
  number: string;
  label: string | null; // null when the number is not in the log
  reports: number; // 0 when the number is not in the log
  blocked: boolean; // on the user's block list
  callsLastHour: number; // including this one
  at: string; // ISO time the call came in
  action: 'notify' | 'silence' | 'reject';
}

/** The number log plus numbers the user blocked (which need not be in the log). */
export function screenList(summaries: NumberSummary[], blocked: string[] = []): ScreenEntry[] {
  const blockedSet = new Set(blocked);
  const entries = summaries.map((s) => ({
    number: s.number,
    label: s.agentName?.trim() || 'Reported number',
    reports: s.reports,
    block: blockedSet.has(s.number),
  }));
  const logged = new Set(entries.map((e) => e.number));
  for (const number of blockedSet) {
    if (!logged.has(number)) entries.push({ number, label: 'Blocked number', reports: 0, block: true });
  }
  return entries;
}

/** Adds or removes a number from the block list; invalid input leaves the list unchanged. */
export function toggleBlocked(blocked: string[], raw: string): string[] {
  const number = normalizeMobile(raw);
  if (!number) return blocked;
  return blocked.includes(number) ? blocked.filter((n) => n !== number) : [...blocked, number];
}

/**
 * SEC Memorandum Circular No. 18, s. 2019 lists contact before 6:00 AM or after 10:00 PM as
 * an unfair collection practice, unless the account is more than 15 days past due or the
 * borrower agreed to those times. So a late call is a *possible* violation, never a verdict.
 */
export function outsideCollectionHours(at: Date): boolean {
  const hour = at.getHours();
  return hour < 6 || hour >= 22;
}

/** Short reasons for the call list, strongest first. */
export function callReasons(call: ScreenedCall): string[] {
  const reasons: string[] = [];
  if (call.blocked) reasons.push('Blocked by you');
  if (call.reports > 0) reasons.push(`In your number log (${call.reports}×)`);
  if (call.callsLastHour >= REPEAT_CALLS) reasons.push(`${call.callsLastHour} calls in an hour`);
  if (outsideCollectionHours(new Date(call.at))) reasons.push('Before 6 AM or after 10 PM');
  return reasons;
}

const timeLabel = (at: Date) =>
  at.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

const HANDLED: Record<ScreenedCall['action'], string> = {
  notify: 'not blocked',
  silence: 'silenced',
  reject: 'declined',
};

/** The note saved with a flagged call in the Evidence Pack. Facts only; the user decides. */
export function screenedCallNote(call: ScreenedCall): string {
  const at = new Date(call.at);
  const lines = [
    `Call from ${call.number}${call.label ? ` (${call.label})` : ''} on ${timeLabel(at)}, ${HANDLED[call.action]} by Unhooked.`,
  ];
  if (call.blocked) lines.push('You blocked this number in Unhooked.');
  if (call.reports > 0) {
    lines.push(`This number is in your number log (${call.reports} report${call.reports === 1 ? '' : 's'}).`);
  }
  if (call.callsLastHour >= REPEAT_CALLS) {
    lines.push(`It called ${call.callsLastHour} times within an hour.`);
  }
  if (outsideCollectionHours(at)) {
    lines.push(
      'It came before 6:00 AM or after 10:00 PM. Under SEC Memorandum Circular No. 18 (2019) that may be an unfair collection practice, unless the account is more than 15 days past due or you agreed to calls at that time.',
    );
  }
  return lines.join(' ');
}

export type NumberLookup =
  | { kind: 'invalid' }
  | { kind: 'unknown'; number: string }
  | { kind: 'reported'; summary: NumberSummary };

/** "Has this number been reported?" for a typed or pasted number. */
export function lookupNumber(raw: string, summaries: NumberSummary[]): NumberLookup {
  const number = normalizeMobile(raw);
  if (!number) return { kind: 'invalid' };
  const summary = summaries.find((s) => s.number === number);
  return summary ? { kind: 'reported', summary } : { kind: 'unknown', number };
}

const ACTIONS = new Set(['notify', 'silence', 'reject']);
const count = (n: unknown, min: number) => (Number.isInteger(n) && (n as number) >= min ? (n as number) : min);

/** Reads the JSON the native service hands back, dropping anything malformed. */
export function parseScreenedCalls(raw: string | null | undefined): ScreenedCall[] {
  if (!raw) return [];
  let items: unknown;
  try {
    items = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(items)) return [];
  const calls: ScreenedCall[] = [];
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;
    const c = item as Record<string, unknown>;
    if (typeof c.number !== 'string' || typeof c.at !== 'string' || Number.isNaN(Date.parse(c.at))) {
      continue;
    }
    if (typeof c.action !== 'string' || !ACTIONS.has(c.action)) continue;
    calls.push({
      number: c.number,
      label: typeof c.label === 'string' && c.label ? c.label : null,
      reports: count(c.reports, 0),
      blocked: c.blocked === true,
      callsLastHour: count(c.callsLastHour, 1),
      at: c.at,
      action: c.action as ScreenedCall['action'],
    });
  }
  return calls;
}
