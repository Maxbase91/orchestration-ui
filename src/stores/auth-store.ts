import { create } from 'zustand';
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

const defaultUsers: Record<Role, User> = {
  'service-owner': { id: 'u1', name: 'Sarah Mitchell', email: 'sarah.mitchell@company.com', role: 'service-owner', department: 'Marketing', initials: 'SM' },
  'procurement-manager': { id: 'u2', name: 'James Chen', email: 'james.chen@company.com', role: 'procurement-manager', department: 'Strategic Procurement', initials: 'JC' },
  'vendor-manager': { id: 'u3', name: 'Anna Kowalski', email: 'anna.kowalski@company.com', role: 'vendor-manager', department: 'Vendor Management', initials: 'AK' },
  'operations-lead': { id: 'u4', name: 'Michael Torres', email: 'michael.torres@company.com', role: 'operations-lead', department: 'Procurement Operations', initials: 'MT' },
  'supplier': { id: 'u5', name: 'David Schneider', email: 'david.schneider@accenture.com', role: 'supplier', department: 'Accenture', initials: 'DS' },
  'admin': { id: 'u6', name: 'Elena Popov', email: 'elena.popov@company.com', role: 'admin', department: 'Platform Administration', initials: 'EP' },
};

export const useAuthStore = create<AuthState>((set) => ({
  currentRole: 'procurement-manager',
  currentUser: defaultUsers['procurement-manager'],
  switchRole: (role: Role) =>
    set({
      currentRole: role,
      currentUser: defaultUsers[role],
    }),
}));
