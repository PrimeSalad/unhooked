// Small, non-sensitive preferences. Records (debts, purchases, …) live in SQLite, not here.

import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { BudgetProfile } from '@/domain/types';

interface SettingsState {
  onboarded: boolean;
  budget: BudgetProfile | null;
  scrollLimitMinutes: number;
  pauseSeconds: number; // the real delay is the active ingredient (PNAS one sec study)
  cloudAiEnabled: boolean; // opt-in only, Phase 7
  setOnboarded: (v: boolean) => void;
  setBudget: (b: BudgetProfile) => void;
  setScrollLimit: (m: number) => void;
  setCloudAi: (v: boolean) => void;
  reset: () => void;
}

const defaults = {
  onboarded: false,
  budget: null,
  scrollLimitMinutes: 20,
  pauseSeconds: 10,
  cloudAiEnabled: false,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults,
      setOnboarded: (onboarded) => set({ onboarded }),
      setBudget: (budget) => set({ budget }),
      setScrollLimit: (scrollLimitMinutes) => set({ scrollLimitMinutes }),
      setCloudAi: (cloudAiEnabled) => set({ cloudAiEnabled }),
      reset: () => set(defaults),
    }),
    { name: 'unhooked-settings', storage: createJSONStorage(() => Storage) },
  ),
);
