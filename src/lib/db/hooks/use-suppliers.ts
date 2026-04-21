import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Supplier } from '@/data/types';
import {
  listSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../suppliers';

const KEYS = {
  all: ['suppliers'] as const,
  list: () => ['suppliers', 'list'] as const,
  detail: (id: string) => ['suppliers', 'detail', id] as const,
};

export function useSuppliers() {
  return useQuery({
    queryKey: KEYS.list(),
    queryFn: listSuppliers,
  });
}

export function useSupplier(id: string | undefined) {
  return useQuery({
    queryKey: KEYS.detail(id ?? ''),
    queryFn: () => getSupplier(id!),
    enabled: Boolean(id),
  });
}

/**
 * Synchronous lookup from the cached supplier list. Returns undefined if the list
 * hasn't been loaded yet — most callers pair this with `useSuppliers()` in the
 * same component so the cache is guaranteed to be populated.
 */
export function useSupplierLookup() {
  const { data } = useSuppliers();
  return (id: string | undefined): Supplier | undefined => {
    if (!id) return undefined;
    return data?.find((s) => s.id === id);
  };
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (record: Supplier) => createSupplier(record),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Supplier> }) => updateSupplier(id, patch),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: KEYS.list() });
    },
  });
}

export function useDeleteSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSupplier(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}
