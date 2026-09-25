// Data access for `functional_roles` (Approval Chains page → Roles).
import { db } from '@/lib/db-client';
import type { Role } from '@/config/roles';
import type { FunctionalRole } from '@/data/functional-roles';
import { roleMapFrom, type RoleMap } from '@/lib/procurement/approval-derivation';

const TABLE = 'functional_roles';

function mapRow(row: Record<string, unknown>): FunctionalRole {
  return {
    name: String(row.name),
    actsAs: String(row.acts_as) as Role,
    description: String(row.description ?? ''),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export async function listFunctionalRoles(): Promise<FunctionalRole[]> {
  const { data, error } = await db.from(TABLE).select('*').order('sort_order').order('name');
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function loadRoleMap(): Promise<RoleMap> {
  return roleMapFrom(await listFunctionalRoles());
}

export async function upsertFunctionalRole(role: FunctionalRole): Promise<void> {
  const { error } = await db.from(TABLE).upsert({
    name: role.name, acts_as: role.actsAs, description: role.description, sort_order: role.sortOrder,
  }, { onConflict: 'name' });
  if (error) throw error;
}

export async function deleteFunctionalRole(name: string): Promise<void> {
  const { error } = await db.from(TABLE).delete().eq('name', name);
  if (error) throw error;
}
