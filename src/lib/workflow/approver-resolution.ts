// Approver resolution — ties approval steps to the switchable role personas.
//
// An approval chain step names a functional role (e.g. "Finance Approver").
// That maps to one of the platform's system roles, and each system role has a
// single canonical persona (the user the role-switcher logs you in as, u1–u6).
// Resolving a step to its persona means a pending approval is always owned by a
// user you can become by switching to the matching role — so the Approve button
// resolves correctly. Standardised and organisation-agnostic.

import type { Role } from '@/config/roles';

// The role map lives in src/lib/procurement/approval-derivation.ts so the
// serverless handlers share one definition with the browser engine; re-exported
// here because this module's callers have always imported it from this path.
import { CHAIN_ROLE_TO_SYSTEM_ROLE } from '@/lib/procurement/approval-derivation';

export { CHAIN_ROLE_TO_SYSTEM_ROLE };

/**
 * The canonical switchable user for each system role — these are real rows in
 * the `users` directory and match the role-switcher exactly, so an approval
 * assigned here is always actionable by switching to the matching role.
 */
export const PERSONA_BY_ROLE: Record<Role, { id: string; name: string }> = {
  'service-owner': { id: 'u6', name: "James O'Brien" },
  'procurement-manager': { id: 'u1', name: 'Anna Müller' },
  'vendor-manager': { id: 'u3', name: 'Sarah Chen' },
  'operations-lead': { id: 'u4', name: 'Marcus Johnson' },
  supplier: { id: 'u13', name: 'David Schneider' },
  admin: { id: 'u11', name: 'Christine Dupont' },
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

/**
 * Strict resolution for a *stage owner*, returning null when the role is not
 * recognised.
 *
 * Deliberately different from resolveApprover above, and the difference is not
 * pedantry. For an approval, somebody must decide, so defaulting to the
 * procurement manager beats leaving the request with no approver at all. For a
 * stage owner, quietly handing the stage to a person the admin never named
 * hides a config error and makes "who owns this step" a lie — an unassigned
 * stage is visibly wrong, which is what you want.
 */
export function resolveStageOwnerRole(chainRole: string | undefined): ResolvedApprover | null {
  if (!chainRole) return null;
  const systemRole = CHAIN_ROLE_TO_SYSTEM_ROLE[chainRole];
  if (!systemRole) {
    console.warn(`[workflow] unmapped stage role "${chainRole}" — stage left unassigned`);
    return null;
  }
  const persona = PERSONA_BY_ROLE[systemRole];
  return { systemRole, id: persona.id, name: persona.name };
}
