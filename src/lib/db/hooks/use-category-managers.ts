// Category → responsible users. Read by the validation stage gate and by any
// screen that needs to name who owns demand in a category.
import { useQuery } from '@tanstack/react-query';
import { listCategoryManagers, type CategoryManager } from '../category-managers';

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
