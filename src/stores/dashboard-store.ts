// Per-role dashboard customisation (widget layout + quick actions).
//
// Persisted. It deliberately was not, on the reasoning that "a role always has
// a sane starting layout" — but `getLayout` already guarantees that: a role
// with no stored entry falls back to the registry default, and `resetToDefault`
// clears the entry to get back there. What the missing persistence actually did
// was throw away every customisation on reload, so adding or removing a widget
// looked like it had silently failed.
//
// A stored layout can name a widget the registry no longer has; the dashboard
// skips ids it cannot resolve, so a removed widget degrades to one fewer tile
// rather than a crash.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { arrayMove } from '@dnd-kit/sortable';
import type { Role } from '@/config/roles';
import { getDefaultLayout, getDefaultQuickActions } from '@/features/dashboard/widget-registry';

interface DashboardState {
  layouts: Record<string, string[]>;
  quickActions: Record<string, string[]>;
  getLayout: (role: Role) => string[];
  setLayout: (role: Role, ids: string[]) => void;
  addWidget: (role: Role, id: string) => void;
  removeWidget: (role: Role, id: string) => void;
  reorderWidgets: (role: Role, fromIndex: number, toIndex: number) => void;
  getQuickActions: (role: Role) => string[];
  setQuickActions: (role: Role, ids: string[]) => void;
  resetToDefault: (role: Role) => void;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      layouts: {},
      quickActions: {},

      getLayout: (role: Role) => {
        // undefined (never customised, or explicitly reset) falls back to the
        // role's registry default rather than an empty grid.
        return get().layouts[role] ?? getDefaultLayout(role);
      },

      setLayout: (role: Role, ids: string[]) => {
        set((state) => ({
          layouts: { ...state.layouts, [role]: ids },
        }));
      },

      addWidget: (role: Role, id: string) => {
        const current = get().getLayout(role);
        if (current.includes(id)) return;
        set((state) => ({
          layouts: { ...state.layouts, [role]: [...current, id] },
        }));
      },

      removeWidget: (role: Role, id: string) => {
        const current = get().getLayout(role);
        set((state) => ({
          layouts: { ...state.layouts, [role]: current.filter((w) => w !== id) },
        }));
      },

      reorderWidgets: (role: Role, fromIndex: number, toIndex: number) => {
        const current = get().getLayout(role);
        set((state) => ({
          layouts: { ...state.layouts, [role]: arrayMove(current, fromIndex, toIndex) },
        }));
      },

      getQuickActions: (role: Role) => {
        return get().quickActions[role] ?? getDefaultQuickActions(role);
      },

      setQuickActions: (role: Role, ids: string[]) => {
        set((state) => ({
          quickActions: { ...state.quickActions, [role]: ids },
        }));
      },

      resetToDefault: (role: Role) => {
        // Setting the entry to undefined (not deleting the key) is deliberate: it
        // makes getLayout/getQuickActions fall through to the registry default on
        // the very next read, same as a role that was never customised.
        set((state) => ({
          layouts: { ...state.layouts, [role]: undefined as unknown as string[] },
          quickActions: { ...state.quickActions, [role]: undefined as unknown as string[] },
        }));
      },
    }),
    {
      name: 'dashboard-layout',
      version: 1,
      // Only the customisation. The getters are behaviour, not state.
      partialize: (state) => ({ layouts: state.layouts, quickActions: state.quickActions }),
    },
  ),
);
