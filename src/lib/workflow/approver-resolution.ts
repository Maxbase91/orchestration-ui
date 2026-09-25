// Stage owner resolution — who owns a workflow stage when a request enters it.
//
// A stage node names a functional role ("Legal", "Vendor management"). Which
// system role acts as it is configuration (functional_roles, Approval Chains
// page → Roles); the owner is that role's persona — the user the role switcher
// signs you in as, so an owned stage is always actionable by switching to it.
//
// This file held its own copy of the role table and its own copy of the
// persona list. Both went (2026-09-25): the table is configuration, and the
// personas have one home in the auth store. `resolveApprover`, which defaulted
// an unknown role to the procurement manager, had no callers left.
import type { RoleMap } from '@/lib/procurement/approval-derivation';
import type { Role } from '@/config/roles';
import { personaForRole } from '@/stores/auth-store';

export interface ResolvedApprover {
  systemRole: Role;
  id: string;
  name: string;
}

/**
 * The owner for a stage's role, or null when the role is not configured.
 *
 * Null rather than a default: quietly handing the stage to a person the admin
 * never named hides a configuration gap and makes "who owns this step" a lie —
 * an unassigned stage is visibly wrong, which is what you want.
 */
export function resolveStageOwnerRole(chainRole: string | undefined, roles: RoleMap): ResolvedApprover | null {
  if (!chainRole) return null;
  const systemRole = roles[chainRole];
  if (!systemRole) {
    console.warn(`[workflow] stage role "${chainRole}" is not configured (Approval Chains → Roles) — stage left unassigned`);
    return null;
  }
  const persona = personaForRole(systemRole);
  return { systemRole, id: persona.id, name: persona.name };
}
