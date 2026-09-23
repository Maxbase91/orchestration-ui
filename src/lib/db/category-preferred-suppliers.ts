// The preferred-supplier list (PSL): which suppliers are preferred for demand in
// a procurement category.
//
// Maintained in /admin/categories, beside the category's managers. Read by the
// intake side panel ("Preferred suppliers for this category"), by the request
// detail, and when a sourcing event is created — every preferred supplier for
// the request's category is invited.
//
// Before this table the "preferred" answer came from `Supplier.preferred`, which
// no column held, so it always fell to a performance heuristic that nobody could
// see or correct. The heuristic survives only for a category with no list set,
// and the screens say which of the two they are showing.
import { db } from '@/lib/db-client';

const TABLE = 'category_preferred_suppliers';

export interface CategoryPreferredSupplier {
  categoryId: string;
  supplierId: string;
}

function mapRow(row: Record<string, unknown>): CategoryPreferredSupplier {
  return { categoryId: String(row.category_id), supplierId: String(row.supplier_id) };
}

export async function listCategoryPreferredSuppliers(): Promise<CategoryPreferredSupplier[]> {
  const { data, error } = await db.from(TABLE).select('category_id, supplier_id');
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

/**
 * Replace a category's preferred suppliers with exactly this set.
 *
 * Delete-then-insert, like category managers: the admin screen means "these are
 * the preferred suppliers now". Not transactional — a failure between the two
 * statements leaves the category with no list, which the screens show as
 * "none set" rather than hiding.
 */
export async function setPreferredSuppliersForCategory(categoryId: string, supplierIds: string[]): Promise<void> {
  const { error: clearError } = await db.from(TABLE).delete().eq('category_id', categoryId);
  if (clearError) throw clearError;

  const unique = [...new Set(supplierIds.filter(Boolean))];
  if (unique.length === 0) return;

  const { error } = await db.from(TABLE).insert(
    unique.map((supplierId) => ({ category_id: categoryId, supplier_id: supplierId })),
  );
  if (error) throw error;
}
