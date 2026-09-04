// Data access for the `delivery_locations` table — the places an order can be
// delivered to. Admin-editable; lists in admin-defined sort order.
import { db } from '@/lib/db-client';

export interface DeliveryLocation {
  id: string;
  label: string;
  address: string;
  /** ISO-3166 alpha-2, when the location drives a country-specific workflow. */
  countryCode: string;
  /**
   * Inactive locations stay in the table so historic orders still resolve their
   * id to a label, but cannot be chosen for a new one. This is the value
   * `evaluateGovernedCheckout` enforces — an order cannot be delivered to a
   * location that is absent or inactive.
   */
  active: boolean;
  sortOrder: number;
}

const TABLE = 'delivery_locations';

function mapRow(row: Record<string, unknown>): DeliveryLocation {
  return {
    id: row.id as string,
    label: row.label as string,
    address: (row.address as string) ?? '',
    countryCode: (row.country_code as string) ?? '',
    active: (row.active as boolean) ?? true,
    sortOrder: (row.sort_order as number) ?? 0,
  };
}

export async function listDeliveryLocations(): Promise<DeliveryLocation[]> {
  const { data, error } = await db.from(TABLE).select('*').order('sort_order');
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function upsertDeliveryLocation(location: DeliveryLocation): Promise<DeliveryLocation> {
  const { data, error } = await db
    .from(TABLE)
    .upsert({
      id: location.id,
      label: location.label,
      address: location.address,
      country_code: location.countryCode,
      active: location.active,
      sort_order: location.sortOrder,
    }, { onConflict: 'id' })
    .select('*')
    .single();
  if (error) throw error;
  return mapRow(data);
}

export async function deleteDeliveryLocation(id: string): Promise<void> {
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
