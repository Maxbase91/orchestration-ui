import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Role } from '@/config/roles';

interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  initials: string;
}

interface AuthState {
  currentRole: Role;
  currentUser: User;
  switchRole: (role: Role) => void;
}

// Canonical switchable personas — one real directory user per system role.
// These ids/names/roles MUST match the `users` table rows (single identity
// namespace): switching to a role makes you that exact user, so "my requests"
// and "my approvals" resolve and the Approve button is actionable.
const defaultUsers: Record<Role, User> = {
  'service-owner': { id: 'u6', name: "James O'Brien", email: 'james.obrien@company.com', role: 'service-owner', department: 'Marketing', initials: 'JO' },
  'procurement-manager': { id: 'u1', name: 'Anna Müller', email: 'anna.mueller@company.com', role: 'procurement-manager', department: 'Global Procurement', initials: 'AM' },
  'vendor-manager': { id: 'u3', name: 'Sarah Chen', email: 'sarah.chen@company.com', role: 'vendor-manager', department: 'IT Procurement', initials: 'SC' },
  'operations-lead': { id: 'u4', name: 'Marcus Johnson', email: 'marcus.johnson@company.com', role: 'operations-lead', department: 'Professional Services', initials: 'MJ' },
  'supplier': { id: 'u13', name: 'David Schneider', email: 'david.schneider@accenture.com', role: 'supplier', department: 'Accenture (External)', initials: 'DS' },
  'admin': { id: 'u11', name: 'Christine Dupont', email: 'christine.dupont@company.com', role: 'admin', department: 'Global Procurement', initials: 'CD' },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      currentRole: 'procurement-manager' as Role,
      currentUser: defaultUsers['procurement-manager'],
      switchRole: (role: Role) =>
        set({
          currentRole: role,
          currentUser: defaultUsers[role],
        }),
    }),
    {
      name: 'auth',
      // Persist ONLY the role and recompute the user from it on load, so a stale
      // persisted identity (e.g. a retired persona from an older build) can never
      // linger — the user is always re-derived from the current canonical set.
      partialize: (state) => ({ currentRole: state.currentRole }),
      merge: (persisted, current) => {
        const role = ((persisted as { currentRole?: Role } | undefined)?.currentRole)
          ?? current.currentRole;
        return { ...current, currentRole: role, currentUser: defaultUsers[role] };
      },
    },
  ),
);
