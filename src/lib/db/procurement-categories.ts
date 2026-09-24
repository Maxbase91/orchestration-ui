// Data access for the `procurement_categories` table (the admin-editable
// category taxonomy used across intake and classification). Lists in admin-
// defined sort_order so display order is data, not code.
import { db } from '@/lib/db-client';
import { commodityFieldsFromRow, type CategoryCode, type CommodityCodeEntry } from '@/lib/procurement/category-code';

export interface ProcurementCategory {
  id: string;
  label: string;
  description: string;
  icon?: string;
  timelineDays: number;
  sortOrder: number;
  active: boolean;
  /**
   * Whether demand in this category can be fulfilled from the catalogue.
   * Gates the intake funnel's catalogue stage (see intake-routing.ts).
   * Defaults false so an unmapped category is never offered the catalogue.
   */
  catalogueEligible: boolean;
  /**
   * Supplier capability tags that cover this category — how a supplier record
   * ("Management Consulting") is recognised as serving it. Read by the supplier
   * recommender and by the preferred-supplier picker.
   */
  supplierTags?: string[];
  /**
   * The commodity codes demand in this category is classified into, each with
   * the description words that point at it. Read by intake classification and
   * the commodity-match endpoint (see lib/procurement/category-code.ts).
   */
  commodityCodes?: CommodityCodeEntry[];
  /** The code a demand gets when no keyword matches. */
  defaultCode?: CategoryCode | null;
}

const TABLE = 'procurement_categories';

function mapRow(row: Record<string, unknown>): ProcurementCategory {
  return {
    id: row.id as string,
    label: row.label as string,
    description: (row.description as string) ?? '',
    icon: row.icon as string | undefined,
    timelineDays: (row.timeline_days as number) ?? 5,
    sortOrder: (row.sort_order as number) ?? 0,
    active: (row.active as boolean) ?? true,
    catalogueEligible: (row.catalogue_eligible as boolean) ?? false,
    supplierTags: Array.isArray(row.supplier_tags) ? (row.supplier_tags as string[]) : [],
    ...commodityFieldsFromRow(row),
  };
}

export async function listProcurementCategories(): Promise<ProcurementCategory[]> {
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .order('sort_order');
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function upsertProcurementCategory(cat: ProcurementCategory): Promise<ProcurementCategory> {
  const { data, error } = await db
    .from(TABLE)
    .upsert({
      id: cat.id,
      label: cat.label,
      description: cat.description,
      icon: cat.icon,
      timeline_days: cat.timelineDays,
      sort_order: cat.sortOrder,
      active: cat.active,
      catalogue_eligible: cat.catalogueEligible,
      supplier_tags: cat.supplierTags ?? [],
      commodity_codes: cat.commodityCodes ?? [],
      default_code: cat.defaultCode?.code || null,
      default_code_label: cat.defaultCode?.label || null,
    }, { onConflict: 'id' })
    .select('*')
    .single();
  if (error) throw error;
  return mapRow(data);
}

export async function deleteProcurementCategory(id: string): Promise<void> {
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
