// Data access for the `cost_centres` table — the accounts a request can be
// charged to. Admin-editable; lists in admin-defined sort order so display
// order is data, not code.
import { db } from '@/lib/db-client';

export interface CostCentre {
  /** The account code, e.g. `CC-ENG-001`. Requests store this value. */
  id: string;
  label: string;
  description: string;
  /** Who signs off spend against it. Free text — there is no owner directory. */
  owner: string;
  /**
   * Inactive centres stay in the table so historic requests still resolve their
   * code to a label, but are not offered for new spend.
   */
  active: boolean;
  sortOrder: number;
}

const TABLE = 'cost_centres';

function mapRow(row: Record<string, unknown>): CostCentre {
  return {
    id: row.id as string,
    label: row.label as string,
    description: (row.description as string) ?? '',
    owner: (row.owner as string) ?? '',
    active: (row.active as boolean) ?? true,
    sortOrder: (row.sort_order as number) ?? 0,
  };
}

export async function listCostCentres(): Promise<CostCentre[]> {
  const { data, error } = await db.from(TABLE).select('*').order('sort_order');
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function upsertCostCentre(centre: CostCentre): Promise<CostCentre> {
  const { data, error } = await db
    .from(TABLE)
    .upsert({
      id: centre.id,
      label: centre.label,
      description: centre.description,
      owner: centre.owner,
      active: centre.active,
      sort_order: centre.sortOrder,
    }, { onConflict: 'id' })
    .select('*')
    .single();
  if (error) throw error;
  return mapRow(data);
}

export async function deleteCostCentre(id: string): Promise<void> {
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
