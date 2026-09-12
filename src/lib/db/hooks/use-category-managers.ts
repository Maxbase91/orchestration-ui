// Category → responsible users. Read by the validation stage gate and by any
// screen that needs to name who owns demand in a category.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listCategoryManagers, setManagersForCategory, type CategoryManager } from '../category-managers';

const KEY = ['category-managers'] as const;

export function useCategoryManagers() {
  return useQuery<CategoryManager[]>({
    queryKey: KEY,
    queryFn: listCategoryManagers,
    // Assignments change when a category changes hands, which is rare.
    staleTime: 5 * 60_000,
  });
}

/** True when this user is responsible for this category. */
export function useIsCategoryManager(userId: string, category: string | undefined): boolean {
  const { data = [] } = useCategoryManagers();
  if (!category) return false;
  return data.some((row) => row.userId === userId && row.categoryId === category);
}

/**
 * Set a category's managers.
 *
 * Invalidates the derived-approver caches as well as the assignment list: who
 * approves a request is computed from this table (approval-derivation.ts), so a
 * reassignment that left the preview showing the old name would be worse than
 * no preview.
 */
export function useSetCategoryManagers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, userIds }: { categoryId: string; userIds: string[] }) =>
      setManagersForCategory(categoryId, userIds),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      void qc.invalidateQueries({ queryKey: ['derived-approvers'] });
      void qc.invalidateQueries({ queryKey: ['approvals'] });
    },
  });
}
