// Small, non-sensitive preferences. Records (debts, purchases, …) live in SQLite, not here.

import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { BudgetProfile } from '@/domain/types';

import { settingsStorage } from './storage';

interface SettingsState {
  onboarded: boolean;
  name: string; // optional; only used for greetings
  budget: BudgetProfile | null;
  scrollLimitMinutes: number;
  pauseSeconds: number; // the real delay is the active ingredient (PNAS one sec study)
  cloudAiEnabled: boolean; // opt-in only: Ask Ginto through Claude
  guardOn: boolean; // master switch for app & website guards
  timerUntil: string | null; // Unhook timer: guarded apps blocked until this time
  fadeAfterMin: number; // doomscroll fade: minutes in a guarded app before the screen washes out (0 = off)
  setOnboarded: (v: boolean) => void;
  setName: (v: string) => void;
  setBudget: (b: BudgetProfile | null) => void;
  setScrollLimit: (m: number) => void;
  setPauseSeconds: (s: number) => void;
  setCloudAi: (v: boolean) => void;
  setGuardOn: (v: boolean) => void;
  setTimerUntil: (iso: string | null) => void;
  setFadeAfterMin: (m: number) => void;
  reset: () => void;
}

const defaults = {
  onboarded: false,
  name: '',
  budget: null,
  scrollLimitMinutes: 20,
  pauseSeconds: 10,
  cloudAiEnabled: false,
  guardOn: true,
  timerUntil: null as string | null,
  fadeAfterMin: 15,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults,
      setOnboarded: (onboarded) => set({ onboarded }),
      setName: (name) => set({ name: name.trim() }),
      setBudget: (budget) => set({ budget }),
      setScrollLimit: (scrollLimitMinutes) => set({ scrollLimitMinutes }),
      setPauseSeconds: (pauseSeconds) => set({ pauseSeconds }),
      setCloudAi: (cloudAiEnabled) => set({ cloudAiEnabled }),
      setGuardOn: (guardOn) => set({ guardOn }),
      setTimerUntil: (timerUntil) => set({ timerUntil }),
      setFadeAfterMin: (fadeAfterMin) => set({ fadeAfterMin }),
      reset: () => set(defaults),
    }),
    {
      name: 'unhooked-settings',
      storage: createJSONStorage(() => settingsStorage),
    },
  ),
);

/** False until persisted settings are loaded, so screens don't flash the wrong state. */
export function useSettingsHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useSettings.persist.onFinishHydration(onChange),
    () => useSettings.persist.hasHydrated(),
  );
}
