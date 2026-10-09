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
