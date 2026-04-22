import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CatalogueItem } from '@/data/catalogue-items';
import {
  listCatalogueItems,
  getCatalogueItem,
  saveCatalogueItem,
  deleteCatalogueItem,
} from '../catalogue-items';

const KEYS = {
  all: ['catalogue-items'] as const,
  list: () => ['catalogue-items', 'list'] as const,
  detail: (id: string) => ['catalogue-items', 'detail', id] as const,
};

export function useCatalogueItems() {
  return useQuery({ queryKey: KEYS.list(), queryFn: listCatalogueItems });
}

export function useCatalogueItem(id: string | undefined) {
  return useQuery({
    queryKey: KEYS.detail(id ?? ''),
    queryFn: () => getCatalogueItem(id!),
    enabled: Boolean(id),
  });
}

export function useSaveCatalogueItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (record: CatalogueItem) => saveCatalogueItem(record),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useDeleteCatalogueItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCatalogueItem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}
