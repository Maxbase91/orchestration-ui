// Data access for the `procurement_categories` table (the admin-editable
// category taxonomy used across intake and classification). Lists in admin-
// defined sort_order — which is also the classifier's precedence: the first
// category whose keywords match a demand wins (lib/procurement/classify.ts).
import { db } from '@/lib/db-client';
import { commodityFieldsFromRow, type CategoryCode, type CommodityCodeEntry } from '@/lib/procurement/category-code';

export interface ProcurementCategory {
  id: string;
  label: string;
  /** What the category covers — given to the AI classifier with the label. */
  description: string;
  /**
   * The words that put a demand in this category when the AI classifier is off
   * or unavailable, matched at the start of a word. They were a regex list in
   * classify.ts that no admin could see or change. (`icon` and `timelineDays`
   * went on 2026-09-25: the icon was never shown, and the timeline disagreed
   * with the workflow's stage targets, which are the real ones.)
   */
  keywords: string[];
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
    keywords: Array.isArray(row.classification_keywords) ? (row.classification_keywords as string[]) : [],
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
      classification_keywords: cat.keywords ?? [],
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
