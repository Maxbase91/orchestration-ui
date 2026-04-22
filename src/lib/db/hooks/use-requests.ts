import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProcurementRequest } from '@/data/types';
import {
  listRequests,
  getRequest,
  createRequest,
  updateRequest,
  deleteRequest,
} from '../requests';

const KEYS = {
  all: ['requests'] as const,
  list: () => ['requests', 'list'] as const,
  detail: (id: string) => ['requests', 'detail', id] as const,
};

export function useRequests() {
  return useQuery({
    queryKey: KEYS.list(),
    queryFn: listRequests,
  });
}

export function useRequest(id: string | undefined) {
  return useQuery({
    queryKey: KEYS.detail(id ?? ''),
    queryFn: () => getRequest(id!),
    enabled: Boolean(id),
  });
}

export function useRequestLookup() {
  const { data } = useRequests();
  return {
    byId: (id: string | undefined): ProcurementRequest | undefined => {
      if (!id) return undefined;
      return data?.find((r) => r.id === id);
    },
    bySupplier: (supplierId: string | undefined): ProcurementRequest[] => {
      if (!supplierId) return [];
      return (data ?? []).filter((r) => r.supplierId === supplierId);
    },
    byContract: (contractId: string | undefined): ProcurementRequest[] => {
      if (!contractId) return [];
      return (data ?? []).filter((r) => r.contractId === contractId);
    },
  };
}

export function useCreateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (record: Partial<ProcurementRequest>) => createRequest(record),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useUpdateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ProcurementRequest> }) =>
      updateRequest(id, patch),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: KEYS.list() });
    },
  });
}

export function useDeleteRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}
