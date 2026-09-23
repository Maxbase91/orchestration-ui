// Category → preferred suppliers. Read by the intake panel, the request detail
// and sourcing-event creation; written from /admin/categories.
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listCategoryPreferredSuppliers, setPreferredSuppliersForCategory, type CategoryPreferredSupplier,
} from '../category-preferred-suppliers';

const KEY = ['category-preferred-suppliers'] as const;

export function useCategoryPreferredSuppliers() {
  return useQuery<CategoryPreferredSupplier[]>({
    queryKey: KEY,
    queryFn: listCategoryPreferredSuppliers,
    // A preferred list changes when a category is re-sourced, which is rare.
    staleTime: 5 * 60_000,
  });
}

/** The supplier ids preferred for one category; empty when none are set. */
export function usePreferredSupplierIds(category: string | undefined): string[] {
  const { data } = useCategoryPreferredSuppliers();
  // Memoised: callers put this in effect and memo dependencies, and a fresh
  // array every render would recompute them all on every render.
  return useMemo(
    () => (category && data ? data.filter((row) => row.categoryId === category).map((row) => row.supplierId) : []),
    [category, data],
  );
}

export function useSetCategoryPreferredSuppliers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, supplierIds }: { categoryId: string; supplierIds: string[] }) =>
      setPreferredSuppliersForCategory(categoryId, supplierIds),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEY }); },
  });
}
