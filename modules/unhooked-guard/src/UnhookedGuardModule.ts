import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { LaunchableApp } from './UnhookedGuard.types';

type UnhookedGuardEvents = {
  onSharedText(event: { text: string }): void;
};

declare class UnhookedGuardModule extends NativeModule<UnhookedGuardEvents> {
  getLaunchableApps(includeIcons: boolean): Promise<LaunchableApp[]>;
  hasUsageAccess(): boolean;
  canDrawOverlays(): boolean;
  openUsageAccessSettings(): void;
  openOverlaySettings(): void;
  startAppGuard(configJson: string): void;
  stopAppGuard(): void;
  allowApp(packageName: string, minutes: number): void;
  goHome(): void;
  isWebGuardPrepared(): boolean;
  prepareWebGuard(): Promise<boolean>;
  startWebGuard(domainsJson: string): void;
  stopWebGuard(): void;
  isCallScreeningAvailable(): boolean;
  hasCallScreeningRole(): boolean;
  requestCallScreeningRole(): Promise<boolean>;
  configureCallScreening(numbersJson: string, mode: string): void;
  takeScreenedCalls(): string;
  takeSharedText(): string | null;
}

/** Null in Expo Go, on iOS and on web: the guard needs an Android development build. */
export default requireOptionalNativeModule<UnhookedGuardModule>('UnhookedGuard');
