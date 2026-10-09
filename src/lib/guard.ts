// Bridge between guard rules and the native Android guard. Safe no-ops elsewhere.

import {
  allowApp,
  isGuardAvailable,
  startAppGuard,
  startWebGuard,
  stopAppGuard,
  stopWebGuard,
} from '../../modules/unhooked-guard';

import type { GuardRule } from '@/domain/blocking';
import { useSettings } from '@/store/settings';

/** Push the current rules (and any running Unhook timer) to the native services. */
export async function syncGuard(rules: GuardRule[]) {
  if (!isGuardAvailable()) return;
  const { guardOn, timerUntil, pauseSeconds } = useSettings.getState();
  const timerMs = timerUntil ? new Date(timerUntil).getTime() : 0;
  const enabled = rules.filter((r) => r.enabled);
  const apps = enabled
    .filter((r) => r.kind === 'app')
    .map((r) => ({
      packageName: r.target,
      label: r.label,
      mode: r.mode,
      start: r.schedule?.start ?? -1,
      end: r.schedule?.end ?? -1,
    }));
  const sites = enabled.filter((r) => r.kind === 'site').map((r) => r.target);

  if (!guardOn || (apps.length === 0 && !timerMs)) stopAppGuard();
  else startAppGuard({ apps, timerUntilMs: timerMs, pauseSeconds });

  if (!guardOn || sites.length === 0) stopWebGuard();
  else await startWebGuard(sites);
}

/** "Open anyway": let one app through for a while, then guard again. */
export function letThrough(packageName: string, minutes: number) {
  if (isGuardAvailable()) allowApp(packageName, minutes);
}

export { isGuardAvailable };
