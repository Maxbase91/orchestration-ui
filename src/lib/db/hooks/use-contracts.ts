import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Contract } from '@/data/types';
import {
  listContracts,
  getContract,
  createContract,
  updateContract,
  deleteContract,
} from '../contracts';

const KEYS = {
  all: ['contracts'] as const,
  list: () => ['contracts', 'list'] as const,
  detail: (id: string) => ['contracts', 'detail', id] as const,
};

export function useContracts() {
  return useQuery({
    queryKey: KEYS.list(),
    queryFn: listContracts,
  });
}

export function useContract(id: string | undefined) {
  return useQuery({
    queryKey: KEYS.detail(id ?? ''),
    queryFn: () => getContract(id!),
    enabled: Boolean(id),
  });
}

export function useContractLookup() {
  const { data } = useContracts();
  return {
    byId: (id: string | undefined): Contract | undefined => {
      if (!id) return undefined;
      return data?.find((c) => c.id === id);
    },
    bySupplier: (supplierId: string | undefined): Contract[] => {
      if (!supplierId) return [];
      return (data ?? []).filter((c) => c.supplierId === supplierId);
    },
  };
}

export function useCreateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (record: Contract) => createContract(record),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useUpdateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Contract> }) => updateContract(id, patch),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: KEYS.list() });
    },
  });
}

export function useDeleteContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteContract(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}
