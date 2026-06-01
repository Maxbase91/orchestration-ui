import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProcurementCategory } from '@/lib/db/procurement-categories';
import {
  listProcurementCategories,
  upsertProcurementCategory,
  deleteProcurementCategory,
} from '@/lib/db/procurement-categories';

const KEYS = {
  all: ['procurement-categories'] as const,
  list: () => ['procurement-categories', 'list'] as const,
};

export function useProcurementCategories() {
  return useQuery({ queryKey: KEYS.list(), queryFn: listProcurementCategories, staleTime: 5 * 60 * 1000 });
}

export function useUpsertProcurementCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cat: ProcurementCategory) => upsertProcurementCategory(cat),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useDeleteProcurementCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProcurementCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}
