// Who is responsible for demand in a procurement category.
//
// `category_managers` answers two questions, and until now only the first was
// wired: which approvers a request derives (src/lib/db/approvals-core.ts reads
// it server-side), and who owns the request before it gets there. The
// validation stage is the second one — WF-001 names "Category Manager" as the
// role that owns it, so the gate reads this table rather than a hardcoded list
// of system roles. There is no `category-manager` role in the six-role model;
// the responsibility is an assignment, not a role.
//
// Note there is still no admin surface for maintaining these assignments; they
// come from db/backfills/2026-09-10-category-managers.mjs. Adding one is
// outstanding.
import { db } from '@/lib/db-client';

const TABLE = 'category_managers';

export interface CategoryManager {
  categoryId: string;
  userId: string;
}

function mapRow(row: Record<string, unknown>): CategoryManager {
  return { categoryId: String(row.category_id), userId: String(row.user_id) };
}

/** Every assignment, for admin screens and for resolving several categories. */
export async function listCategoryManagers(): Promise<CategoryManager[]> {
  const { data, error } = await db.from(TABLE).select('category_id, user_id');
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

/** The users responsible for one category. Empty when nobody is assigned. */
export async function listManagersForCategory(categoryId: string): Promise<CategoryManager[]> {
  const { data, error } = await db.from(TABLE).select('category_id, user_id').eq('category_id', categoryId);
  if (error) throw error;
  return (data ?? []).map(mapRow);
}
