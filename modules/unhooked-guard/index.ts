// App & website guard (plan.md Phase 4B). Android dev build only; every call is safe elsewhere.
import { Platform } from 'react-native';

import NativeGuard from './src/UnhookedGuardModule';
import type { LaunchableApp } from './src/UnhookedGuard.types';

export type { AppCategory, LaunchableApp } from './src/UnhookedGuard.types';

function native() {
  return Platform.OS === 'android' ? NativeGuard : null;
}

/** False in Expo Go, on iOS and on web. Screens show "Available in the full Android app". */
export function isGuardAvailable(): boolean {
  return native() != null;
}

/** Launchable apps sorted A–Z, without Unhooked itself. Empty when the guard isn't available. */
export async function getLaunchableApps(
  options: { includeIcons?: boolean } = {},
): Promise<LaunchableApp[]> {
  const guard = native();
  if (!guard) return [];
  const apps = await guard.getLaunchableApps(options.includeIcons ?? true);
  return [...apps].sort((a, b) => a.label.localeCompare(b.label));
}

export function hasUsageAccess(): boolean {
  return native()?.hasUsageAccess() ?? false;
}

export function canDrawOverlays(): boolean {
  return native()?.canDrawOverlays() ?? false;
}

/** Call only after the in-app disclosure and the user tapping Allow (Play prominent-disclosure rule). */
export function openUsageAccessSettings(): void {
  native()?.openUsageAccessSettings();
}

/** Call only after the in-app disclosure and the user tapping Allow (Play prominent-disclosure rule). */
export function openOverlaySettings(): void {
  native()?.openOverlaySettings();
}

export interface GuardedApp {
  packageName: string;
  label: string;
  mode: 'pause' | 'strict';
  /** Minutes after midnight; -1 = all day. */
  start: number;
  end: number;
}

/**
 * Starts (or updates) the foreground app guard. No-op where the guard isn't available.
 * fadeAfterMin: minutes in a guarded app before the doomscroll fade and check-in (0 = off).
 */
export function startAppGuard(config: {
  apps: GuardedApp[];
  timerUntilMs: number;
  pauseSeconds: number;
  fadeAfterMin: number;
}) {
  native()?.startAppGuard(JSON.stringify(config));
}

export function stopAppGuard() {
  native()?.stopAppGuard();
}

/** "Open anyway": let one app through for `minutes`, then open it. */
export function allowApp(packageName: string, minutes: number) {
  native()?.allowApp(packageName, minutes);
}

/** Sends the user to the home screen (the "Close it" choice on the shield). */
export function goHome() {
  native()?.goHome();
}

export function isWebGuardPrepared(): boolean {
  return native()?.isWebGuardPrepared() ?? false;
}

/** Shows Android's VPN consent dialog. Call only after the in-app disclosure and "Allow". */
export async function prepareWebGuard(): Promise<boolean> {
  return (await native()?.prepareWebGuard()) ?? false;
}

/** Starts the local DNS-only web guard for these bare domains (requires prepareWebGuard). */
export async function startWebGuard(domains: string[]) {
  native()?.startWebGuard(JSON.stringify(domains));
}

export function stopWebGuard() {
  native()?.stopWebGuard();
}
