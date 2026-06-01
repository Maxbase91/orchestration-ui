import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  currency: string;
  setCurrency: (currency: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      currency: 'EUR',
      setCurrency: (currency: string) => set({ currency }),
    }),
    {
      name: 'settings',
      partialize: (state) => ({ currency: state.currency }),
    },
  ),
);
