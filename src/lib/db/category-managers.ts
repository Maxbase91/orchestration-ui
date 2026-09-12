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
// Maintained from /admin/categories. Until 2026-09-13 the only writer was
// db/backfills/2026-09-10-category-managers.mjs, so the table was fully consumed
// by two things and correctable by nobody.
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

/**
 * Replace a category's managers with exactly this set.
 *
 * Delete-then-insert rather than a diff: the set is small (a handful of people
 * per category) and the whole-set write is what the admin screen means — "these
 * are the managers now". A diff would have to reason about `assigned_at` for
 * rows it keeps, which nothing reads.
 *
 * Not transactional. The two statements go through the /api/db boundary
 * separately, so a failure between them leaves a category with no manager —
 * which the derivation and the stage gate both handle (role mode, and admin can
 * still advance), and which the screen shows as an explicit warning rather than
 * silently. Worth knowing before this is used for anything where the empty
 * state is not safe.
 */
export async function setManagersForCategory(categoryId: string, userIds: string[]): Promise<void> {
  const { error: clearError } = await db.from(TABLE).delete().eq('category_id', categoryId);
  if (clearError) throw clearError;

  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return;

  const { error } = await db.from(TABLE).insert(
    unique.map((userId) => ({ category_id: categoryId, user_id: userId })),
  );
  if (error) throw error;
}
