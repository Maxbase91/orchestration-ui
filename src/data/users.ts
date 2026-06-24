// Seed data only — not read by the runtime app.
//
// Users moved to Supabase in Wave 1. UI reads via `@/lib/db/hooks/use-users`.
// This file remains as the source of truth for `api/admin/seed.ts`.

import type { User } from './types';

// Single identity namespace — every user carries one of the 6 canonical system
// roles. The role-switcher's switchable personas are real rows here (u6, u1, u3,
// u4, u13, u11 — one per role); the rest are additional members of those roles.
export const users: User[] = [
  { id: 'u1', name: 'Anna Müller', email: 'anna.mueller@company.com', role: 'procurement-manager', department: 'Global Procurement', initials: 'AM', isOOO: false, country: 'Germany', countryCode: 'DE' },
  { id: 'u2', name: 'Thomas Weber', email: 'thomas.weber@company.com', role: 'procurement-manager', department: 'Global Procurement', initials: 'TW', isOOO: true, delegateId: 'u1', country: 'Germany', countryCode: 'DE' },
  { id: 'u3', name: 'Sarah Chen', email: 'sarah.chen@company.com', role: 'vendor-manager', department: 'IT Procurement', initials: 'SC', isOOO: false, country: 'United Kingdom', countryCode: 'GB' },
  { id: 'u4', name: 'Marcus Johnson', email: 'marcus.johnson@company.com', role: 'operations-lead', department: 'Professional Services', initials: 'MJ', isOOO: false, country: 'United States', countryCode: 'US' },
  { id: 'u5', name: 'Elena Petrova', email: 'elena.petrova@company.com', role: 'service-owner', department: 'Engineering', initials: 'EP', isOOO: false, country: 'Netherlands', countryCode: 'NL' },
  { id: 'u6', name: 'James O\'Brien', email: 'james.obrien@company.com', role: 'service-owner', department: 'Marketing', initials: 'JO', isOOO: false, country: 'Ireland', countryCode: 'IE' },
  { id: 'u7', name: 'Dr. Katrin Bauer', email: 'katrin.bauer@company.com', role: 'procurement-manager', department: 'Finance', initials: 'KB', isOOO: false, country: 'Germany', countryCode: 'DE' },
  { id: 'u8', name: 'Robert Fischer', email: 'robert.fischer@company.com', role: 'procurement-manager', department: 'Finance', initials: 'RF', isOOO: true, delegateId: 'u7', country: 'Austria', countryCode: 'AT' },
  { id: 'u9', name: 'Lisa Nakamura', email: 'lisa.nakamura@company.com', role: 'vendor-manager', department: 'Supplier Relations', initials: 'LN', isOOO: false, country: 'Sweden', countryCode: 'SE' },
  { id: 'u10', name: 'David Kowalski', email: 'david.kowalski@company.com', role: 'vendor-manager', department: 'Supplier Relations', initials: 'DK', isOOO: false, country: 'Poland', countryCode: 'PL' },
  { id: 'u11', name: 'Christine Dupont', email: 'christine.dupont@company.com', role: 'admin', department: 'Global Procurement', initials: 'CD', isOOO: false, country: 'France', countryCode: 'FR' },
  { id: 'u12', name: 'Henrik Larsson', email: 'henrik.larsson@company.com', role: 'admin', department: 'Global Procurement', initials: 'HL', isOOO: false, country: 'Sweden', countryCode: 'SE' },
  { id: 'u13', name: 'David Schneider', email: 'david.schneider@accenture.com', role: 'supplier', department: 'Accenture (External)', initials: 'DS', isOOO: false, country: 'Switzerland', countryCode: 'CH' },
];

export function getUserById(id: string): User | undefined {
  return users.find((u) => u.id === id);
}

export function getUsersByRole(role: string): User[] {
  return users.filter((u) => u.role === role);
}
