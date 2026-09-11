// TanStack Query hooks over lib/db/purchase-orders. Query keys live under the
// ['purchase-orders'] prefix; usePurchaseOrderLookup resolves by-contract/
// by-supplier joins from the cached list.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateRequestViews } from '@/lib/query-client';
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
    onSuccess: (_data, record) => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      // A PO belongs to a request, and raising one changes what that request's
      // screens should show. This refreshed the order list and nothing else, so
      // the request the PO was raised against kept its previous state until a
      // reload — the page navigates away, which is the only reason it was not
      // obvious.
      if (record.requestId) invalidateRequestViews(qc);
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
