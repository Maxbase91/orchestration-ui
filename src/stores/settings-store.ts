import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  currency: string;
  matchTolerancePct: number; // 0-100, e.g. 2 = 2% minor variance threshold
  setCurrency: (currency: string) => void;
  setMatchTolerancePct: (pct: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      currency: 'EUR',
      matchTolerancePct: 2,
      setCurrency: (currency: string) => set({ currency }),
      setMatchTolerancePct: (matchTolerancePct: number) => set({ matchTolerancePct }),
    }),
    {
      name: 'settings',
      partialize: (state) => ({ currency: state.currency, matchTolerancePct: state.matchTolerancePct }),
    },
  ),
);
