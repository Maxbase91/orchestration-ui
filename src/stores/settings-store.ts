import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Which home design renders at `/`. 'dashboard' = the current functional
 *  dashboard (default); '1a'/'1b'/'1c' are the alternative Apple-style designs,
 *  each fully functional. Switchable from the top-bar design picker. */
export type HomeDesign = 'dashboard' | '1a' | '1b' | '1c';

interface SettingsState {
  currency: string;
  matchTolerancePct: number; // 0-100, e.g. 2 = 2% minor variance threshold
  homeDesign: HomeDesign;
  setCurrency: (currency: string) => void;
  setMatchTolerancePct: (pct: number) => void;
  setHomeDesign: (design: HomeDesign) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      currency: 'EUR',
      matchTolerancePct: 2,
      homeDesign: 'dashboard',
      setCurrency: (currency: string) => set({ currency }),
      setMatchTolerancePct: (matchTolerancePct: number) => set({ matchTolerancePct }),
      setHomeDesign: (homeDesign: HomeDesign) => set({ homeDesign }),
    }),
    {
      name: 'settings',
      partialize: (state) => ({
        currency: state.currency,
        matchTolerancePct: state.matchTolerancePct,
        homeDesign: state.homeDesign,
      }),
    },
  ),
);
