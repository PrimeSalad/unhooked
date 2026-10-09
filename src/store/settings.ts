// Small, non-sensitive preferences. Records (debts, purchases, …) live in SQLite, not here.

import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { BudgetProfile } from '@/domain/types';
import {
  LOCAL_MODEL_BY_ID,
  type LocalModelChoice,
  type PerformanceMode,
  type ProcessorChoice,
} from '@/ai/localModels';

import { settingsStorage } from './storage';

interface SettingsState {
  onboarded: boolean;
  name: string; // optional; only used for greetings
  budget: BudgetProfile | null;
  scrollLimitMinutes: number;
  pauseSeconds: number; // the real delay is the active ingredient (PNAS one sec study)
  localAiModel: LocalModelChoice; // auto picks a model fit from the current Android device
  localAiPerformance: PerformanceMode; // balanced favors battery; max tries the NPU first
  localAiProcessor: ProcessorChoice; // auto picks the fastest chip that works
  permissionsReviewed: boolean; // microphone and reminder disclosure has been shown
  guardOn: boolean; // master switch for app & website guards
  timerUntil: string | null; // Unhook timer: guarded apps blocked until this time
  fadeAfterMin: number; // doomscroll fade: minutes in a guarded app before the screen washes out (0 = off)
  lastBreakIdea: string | null; // last break suggestion shown, so we never repeat it
  setOnboarded: (v: boolean) => void;
  setName: (v: string) => void;
  setBudget: (b: BudgetProfile | null) => void;
  setScrollLimit: (m: number) => void;
  setPauseSeconds: (s: number) => void;
  setLocalAiModel: (v: LocalModelChoice) => void;
  setLocalAiPerformance: (v: PerformanceMode) => void;
  setLocalAiProcessor: (v: ProcessorChoice) => void;
  setPermissionsReviewed: (v: boolean) => void;
  setGuardOn: (v: boolean) => void;
  setTimerUntil: (iso: string | null) => void;
  setFadeAfterMin: (m: number) => void;
  setLastBreakIdea: (id: string | null) => void;
  reset: () => void;
}

const defaults = {
  onboarded: false,
  name: '',
  budget: null,
  scrollLimitMinutes: 20,
  pauseSeconds: 10,
  localAiModel: 'auto' as LocalModelChoice,
  localAiPerformance: 'balanced' as PerformanceMode,
  localAiProcessor: 'auto' as ProcessorChoice,
  permissionsReviewed: false,
  guardOn: true,
  timerUntil: null as string | null,
  fadeAfterMin: 15,
  lastBreakIdea: null as string | null,
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
      setLocalAiModel: (localAiModel) => set({ localAiModel }),
      setLocalAiPerformance: (localAiPerformance) => set({ localAiPerformance }),
      setLocalAiProcessor: (localAiProcessor) => set({ localAiProcessor }),
      setPermissionsReviewed: (permissionsReviewed) => set({ permissionsReviewed }),
      setGuardOn: (guardOn) => set({ guardOn }),
      setTimerUntil: (timerUntil) => set({ timerUntil }),
      setFadeAfterMin: (fadeAfterMin) => set({ fadeAfterMin }),
      setLastBreakIdea: (lastBreakIdea) => set({ lastBreakIdea }),
      reset: () => set(defaults),
    }),
    {
      name: 'unhooked-settings',
      storage: createJSONStorage(() => settingsStorage),
      // A saved model that has left the catalog (the Qwen models) falls back to Auto.
      merge: (persisted, current) => {
        const saved = { ...current, ...(persisted as Partial<SettingsState>) };
        const known = saved.localAiModel === 'auto' || saved.localAiModel in LOCAL_MODEL_BY_ID;
        return known ? saved : { ...saved, localAiModel: 'auto' };
      },
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
