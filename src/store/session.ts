// Ephemeral UI state (not persisted): the global toast and the quick-pause sheet.

import { create } from 'zustand';

interface SessionState {
  toast: string | null;
  quickPauseOpen: boolean;
  showToast: (message: string) => void;
  clearToast: () => void;
  setQuickPause: (open: boolean) => void;
}

export const useSession = create<SessionState>()((set) => ({
  toast: null,
  quickPauseOpen: false,
  showToast: (toast) => set({ toast }),
  clearToast: () => set({ toast: null }),
  setQuickPause: (quickPauseOpen) => set({ quickPauseOpen }),
}));
