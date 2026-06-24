// Approver resolution — ties approval steps to the switchable role personas.
//
// An approval chain step names a functional role (e.g. "Finance Approver").
// That maps to one of the platform's system roles, and each system role has a
// single canonical persona (the user the role-switcher logs you in as, u1–u6).
// Resolving a step to its persona means a pending approval is always owned by a
// user you can become by switching to the matching role — so the Approve button
// resolves correctly. Standardised and organisation-agnostic.

import type { Role } from '@/config/roles';

/** Chain/functional role → system role. */
export const CHAIN_ROLE_TO_SYSTEM_ROLE: Record<string, Role> = {
  'Budget Owner': 'service-owner',
  'Business Requestor': 'service-owner',
  'Category Manager': 'procurement-manager',
  'Procurement Manager': 'procurement-manager',
  'Procurement Lead': 'procurement-manager',
  Finance: 'procurement-manager',
  'Finance Approver': 'procurement-manager',
  'VP Procurement': 'admin',
  CFO: 'admin',
  Board: 'admin',
  Approver: 'procurement-manager',
  'New Approver': 'procurement-manager',
  'Supplier Manager': 'vendor-manager',
  'Operations Lead': 'operations-lead',
};

/** The canonical persona for each system role — matches the role-switcher (u1–u6). */
export const PERSONA_BY_ROLE: Record<Role, { id: string; name: string }> = {
  'service-owner': { id: 'u1', name: 'Sarah Mitchell' },
  'procurement-manager': { id: 'u2', name: 'James Chen' },
  'vendor-manager': { id: 'u3', name: 'Anna Kowalski' },
  'operations-lead': { id: 'u4', name: 'Michael Torres' },
  supplier: { id: 'u5', name: 'David Schneider' },
  admin: { id: 'u6', name: 'Elena Popov' },
};

export interface ResolvedApprover {
  systemRole: Role;
  id: string;
  name: string;
}

/**
 * Resolve an approval step's functional role to its system role + canonical
 * persona. Unknown roles fall back to procurement-manager.
 */
export function resolveApprover(chainRole: string | undefined): ResolvedApprover {
  const systemRole = (chainRole && CHAIN_ROLE_TO_SYSTEM_ROLE[chainRole]) || 'procurement-manager';
  const persona = PERSONA_BY_ROLE[systemRole];
  return { systemRole, id: persona.id, name: persona.name };
}
