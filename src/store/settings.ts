// Small, non-sensitive preferences. Records (debts, purchases, …) live in SQLite, not here.

import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { BudgetProfile } from '@/domain/types';

import { settingsStorage } from './storage';

export type FocusPreference = 'debt' | 'spend' | 'scroll';

export interface OnboardingDraft {
  step: 0 | 1 | 2 | 3;
  name: string;
  focus: FocusPreference | null;
  income: string;
  bills: string;
  savings: string;
  scrollLimit: string;
  skipBudget: boolean;
}

const emptyDraft: OnboardingDraft = {
  step: 0,
  name: '',
  focus: null,
  income: '',
  bills: '',
  savings: '',
  scrollLimit: '20',
  skipBudget: false,
};

interface SettingsState {
  onboarded: boolean;
  name: string; // optional; only used for greetings
  budget: BudgetProfile | null;
  scrollLimitMinutes: number;
  pauseSeconds: number; // the real delay is the active ingredient (PNAS one sec study)
  guardOn: boolean; // master switch for app & website guards
  timerUntil: string | null; // Unhook timer: guarded apps blocked until this time
  fadeAfterMin: number; // doomscroll fade: minutes in a guarded app before the screen washes out (0 = off)
  focus: FocusPreference | null;
  onboardingDraft: OnboardingDraft;
  updateOnboardingDraft: (draft: Partial<OnboardingDraft>) => Promise<void>;
  completeOnboarding: (preferences: {
    name: string;
    focus: FocusPreference | null;
    budget?: BudgetProfile | null;
    scrollLimitMinutes?: number;
  }) => Promise<void>;
  setOnboarded: (v: boolean) => void;
  setName: (v: string) => void;
  setFocus: (focus: FocusPreference | null) => void;
  setBudget: (b: BudgetProfile | null) => void;
  setScrollLimit: (m: number) => void;
  setPauseSeconds: (s: number) => void;
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
  guardOn: true,
  timerUntil: null as string | null,
  fadeAfterMin: 15,
  focus: null as FocusPreference | null,
  onboardingDraft: emptyDraft,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...defaults,
      updateOnboardingDraft: async (draft) => {
        // Persist every step and input so Back, app restarts and reloads keep the same draft.
        await set({ onboardingDraft: { ...get().onboardingDraft, ...draft } });
      },
      completeOnboarding: async (preferences) => {
        const previous = get();
        try {
          // The persist middleware returns the storage write; wait before leaving onboarding.
          await set({
            ...preferences,
            name: preferences.name.trim(),
            onboarded: true,
            onboardingDraft: { ...get().onboardingDraft, step: 0 },
          });
        } catch (error) {
          // Keep the editable draft and completion screen available when storage is unavailable.
          try {
            await set({
              onboarded: previous.onboarded,
              name: previous.name,
              focus: previous.focus,
              budget: previous.budget,
              scrollLimitMinutes: previous.scrollLimitMinutes,
              onboardingDraft: { ...get().onboardingDraft, step: 3 },
            });
          } catch {
            // Memory is already restored even if the retry cannot reach persistent storage.
          }
          throw error;
        }
      },
      setOnboarded: (onboarded) => set({ onboarded }),
      setName: (name) =>
        set({ name: name.trim(), onboardingDraft: { ...get().onboardingDraft, name } }),
      setFocus: (focus) => set({ focus, onboardingDraft: { ...get().onboardingDraft, focus } }),
      setBudget: (budget) =>
        set({
          budget,
          onboardingDraft: {
            ...get().onboardingDraft,
            income: budget ? String(budget.monthlyIncome / 100) : '',
            bills: budget ? String(budget.monthlyFixedBills / 100) : '',
            savings: budget ? String(budget.savingsGoalMonthly / 100) : '',
          },
        }),
      setScrollLimit: (scrollLimitMinutes) =>
        set({
          scrollLimitMinutes,
          onboardingDraft: { ...get().onboardingDraft, scrollLimit: String(scrollLimitMinutes) },
        }),
      setPauseSeconds: (pauseSeconds) => set({ pauseSeconds }),
      setGuardOn: (guardOn) => set({ guardOn }),
      setTimerUntil: (timerUntil) => set({ timerUntil }),
      setFadeAfterMin: (fadeAfterMin) => set({ fadeAfterMin }),
      reset: () => set(defaults),
    }),
    {
      name: 'unhooked-settings',
      storage: createJSONStorage(() => settingsStorage),
      merge: (persisted, current) => {
        const saved = persisted as Partial<SettingsState> | undefined;
        const budget = saved?.budget;
        return {
          ...current,
          ...saved,
          onboardingDraft: {
            ...emptyDraft,
            name: saved?.name ?? '',
            focus: saved?.focus ?? null,
            income: budget ? String(budget.monthlyIncome / 100) : '',
            bills: budget ? String(budget.monthlyFixedBills / 100) : '',
            savings: budget ? String(budget.savingsGoalMonthly / 100) : '',
            scrollLimit: String(saved?.scrollLimitMinutes ?? defaults.scrollLimitMinutes),
            ...saved?.onboardingDraft,
          },
        };
      },
    },
  ),
);

/** False until persisted settings are loaded, so screens don't flash the wrong state. */
export function useSettingsHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useSettings.persist.onFinishHydration(onChange),
    () => useSettings.persist.hasHydrated(),
    () => false,
  );
}
