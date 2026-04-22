import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PurchaseOrder } from '@/data/types';
import {
  listPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
} from '../purchase-orders';

const KEYS = {
  all: ['purchase-orders'] as const,
  list: () => ['purchase-orders', 'list'] as const,
  detail: (id: string) => ['purchase-orders', 'detail', id] as const,
};

export function usePurchaseOrders() {
  return useQuery({
    queryKey: KEYS.list(),
    queryFn: listPurchaseOrders,
  });
}

export function usePurchaseOrder(id: string | undefined) {
  return useQuery({
    queryKey: KEYS.detail(id ?? ''),
    queryFn: () => getPurchaseOrder(id!),
    enabled: Boolean(id),
  });
}

export function usePurchaseOrderLookup() {
  const { data } = usePurchaseOrders();
  return {
    byId: (id: string | undefined): PurchaseOrder | undefined => {
      if (!id) return undefined;
      return data?.find((p) => p.id === id);
    },
    byContract: (contractId: string | undefined): PurchaseOrder[] => {
      if (!contractId) return [];
      return (data ?? []).filter((p) => p.contractId === contractId);
    },
    bySupplier: (supplierId: string | undefined): PurchaseOrder[] => {
      if (!supplierId) return [];
      return (data ?? []).filter((p) => p.supplierId === supplierId);
    },
  };
}

export function useCreatePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (record: PurchaseOrder) => createPurchaseOrder(record),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useUpdatePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<PurchaseOrder> }) =>
      updatePurchaseOrder(id, patch),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: KEYS.list() });
    },
  });
}

export function useDeletePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePurchaseOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}
