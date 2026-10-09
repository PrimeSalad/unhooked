// Ephemeral UI state (not persisted): the global toast and the quick-pause sheet.

import { create } from 'zustand';

interface SessionState {
  toast: string | null;
  quickPauseOpen: boolean;
  scrollPauseUntil: Record<string, number>;
  scrollReminderIds: Record<string, string | null>;
  showToast: (message: string) => void;
  clearToast: () => void;
  setQuickPause: (open: boolean) => void;
  snoozeScrollPause: (sessionId: string, until: number) => void;
  setScrollReminderId: (sessionId: string, reminderId: string | null) => void;
}

export const useSession = create<SessionState>()((set) => ({
  toast: null,
  quickPauseOpen: false,
  scrollPauseUntil: {},
  scrollReminderIds: {},
  showToast: (toast) => set({ toast }),
  clearToast: () => set({ toast: null }),
  setQuickPause: (quickPauseOpen) => set({ quickPauseOpen }),
  snoozeScrollPause: (sessionId, until) =>
    set((state) => ({ scrollPauseUntil: { ...state.scrollPauseUntil, [sessionId]: until } })),
  setScrollReminderId: (sessionId, reminderId) =>
    set((state) => ({
      scrollReminderIds: { ...state.scrollReminderIds, [sessionId]: reminderId },
    })),
}));
