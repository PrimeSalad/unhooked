// Today's counters for the UI phase. Phase 5 derives these from the event log instead.

import { create } from 'zustand';

export type Outcome = 'saved' | 'cheaper' | 'review' | 'plan';

interface SessionState {
  pauses: number;
  breaks: number;
  cooling: number;
  lastOutcome: Outcome;
  toast: string | null;
  recordPause: (outcome: Outcome) => void;
  addBreak: () => void;
  showToast: (message: string) => void;
  clearToast: () => void;
}

export const useSession = create<SessionState>()((set) => ({
  pauses: 3,
  breaks: 2,
  cooling: 0,
  lastOutcome: 'saved',
  toast: null,
  recordPause: (outcome) =>
    set((s) => ({
      pauses: s.pauses + 1,
      cooling: outcome === 'saved' ? 1 : s.cooling,
      lastOutcome: outcome,
    })),
  addBreak: () => set((s) => ({ breaks: s.breaks + 1 })),
  showToast: (toast) => set({ toast }),
  clearToast: () => set({ toast: null }),
}));
