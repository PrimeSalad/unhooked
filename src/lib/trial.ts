// Reads when this install started. Uses the earliest of the time this APK was installed or
// updated (survives "Clear data"; a v1.0.0 user updating to the trial build gets a full window)
// and the first launch we recorded (survives nothing the OS does not).
// The hard expiry in constants/trial.ts is what stops a plain uninstall/reinstall.
// Once a trial has ended it stays ended on this install, even if the clock is moved back.

import * as Application from 'expo-application';
import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';

import { TRIAL_DAYS, TRIAL_HARD_EXPIRY } from '@/constants/trial';
import { trialStatus, type TrialStatus } from '@/domain/trial';

const FIRST_SEEN_KEY = 'unhooked.trial.firstSeen';
const LAST_SEEN_KEY = 'unhooked.trial.lastSeen';
const ENDED_KEY = 'unhooked.trial.ended';

async function readNumber(key: string): Promise<number | null> {
  const raw = await Storage.getItem(key);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

export async function getInstalledAt(): Promise<number> {
  const now = Date.now();
  const stored = await readNumber(FIRST_SEEN_KEY);
  let native: number | null = null;
  if (Platform.OS !== 'web') {
    try {
      native = (await Application.getLastUpdateTimeAsync()).getTime();
    } catch {
      native = null;
    }
  }
  const candidates = [stored, native].filter((t): t is number => t != null && t > 0);
  const installedAt = candidates.length ? Math.min(...candidates) : now;
  if (stored == null) await Storage.setItem(FIRST_SEEN_KEY, String(installedAt));
  return installedAt;
}

export function statusFor(installedAt: number, now = Date.now(), lastSeenAt?: number): TrialStatus {
  return trialStatus(installedAt, now, TRIAL_DAYS, Date.parse(TRIAL_HARD_EXPIRY), lastSeenAt);
}

/** Current trial state for this install. Records the clock so rolling it back does not help. */
export async function checkTrial(now = Date.now()): Promise<TrialStatus> {
  const installedAt = await getInstalledAt();
  if ((await Storage.getItem(ENDED_KEY)) === '1') {
    return { expired: true, endsAt: statusFor(installedAt, now).endsAt, remainingMs: 0 };
  }
  const lastSeen = await readNumber(LAST_SEEN_KEY);
  const status = statusFor(installedAt, now, lastSeen ?? installedAt);
  if (status.expired) await Storage.setItem(ENDED_KEY, '1');
  else if (lastSeen == null || now > lastSeen) await Storage.setItem(LAST_SEEN_KEY, String(now));
  return status;
}
