// App & website guard rules (plan.md Phase 4B). Pure and tested; native code only enforces.

export type GuardKind = 'app' | 'site';
export type GuardMode = 'pause' | 'strict';

/** Minutes after midnight, local time. */
export interface Schedule {
  start: number;
  end: number;
}

export interface GuardRule {
  id: string;
  kind: GuardKind;
  target: string; // package name or bare domain
  label: string;
  mode: GuardMode;
  schedule: Schedule | null; // null = always on
  enabled: boolean;
  createdAt: string;
}

/** Help must stay reachable (R5) and the phone must stay usable. */
export const NEVER_BLOCK_DOMAINS = [
  'sec.gov.ph',
  'acg.pnp.gov.ph',
  'privacy.gov.ph',
  'doh.gov.ph',
  'ncmh.gov.ph',
];
export const NEVER_BLOCK_PACKAGES = ['ph.appbuilders.unhooked', 'com.android.settings'];

const HOST_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export type DomainResult = { ok: true; domain: string } | { ok: false; error: string };

/** Accepts whatever the user pastes and returns a bare lowercase host. */
export function normalizeDomain(input: string): DomainResult {
  let s = input.trim().toLowerCase();
  if (!s) return { ok: false, error: 'Type or paste a website first.' };
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  s = s.split(/[/?#]/)[0] ?? '';
  s = s
    .replace(/^[^@]*@/, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
  s = s.replace(/^(www|m|mobile)\./, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s) || s.includes(':')) {
    return { ok: false, error: 'Use the website name, not a number address.' };
  }
  if (s === 'localhost' || !HOST_RE.test(s)) {
    return { ok: false, error: 'That does not look like a website. Try something like shopee.ph.' };
  }
  if (NEVER_BLOCK_DOMAINS.some((d) => s === d || s.endsWith(`.${d}`))) {
    return { ok: false, error: 'Help and reporting sites always stay open.' };
  }
  return { ok: true, domain: s };
}

/** A rule covers its subdomains, never look-alikes. */
export function matchesDomain(host: string, domains: string[]): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  return domains.some((d) => h === d || h.endsWith(`.${d}`));
}

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Always-on, or inside a schedule that may cross midnight (e.g. 22:00–06:00). */
export function isGuardActive(rule: Pick<GuardRule, 'enabled' | 'schedule'>, now: Date): boolean {
  if (!rule.enabled) return false;
  if (!rule.schedule) return true;
  const { start, end } = rule.schedule;
  const m = minutesOfDay(now);
  if (start === end) return true;
  return start < end ? m >= start && m < end : m >= start || m < end;
}

export function formatSchedule(s: Schedule | null): string {
  if (!s) return 'All day';
  const fmt = (min: number) => {
    const h = Math.floor(min / 60);
    const mm = String(min % 60).padStart(2, '0');
    return `${h % 12 === 0 ? 12 : h % 12}:${mm} ${h >= 12 ? 'PM' : 'AM'}`;
  };
  return `${fmt(s.start)} – ${fmt(s.end)}`;
}

/** Seconds of pause before "Open anyway" unlocks. */
export const pauseSecondsFor = (mode: GuardMode, base: number) => (mode === 'strict' ? 60 : base);
