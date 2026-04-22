import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Invoice } from '@/data/types';
import {
  listInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
} from '../invoices';

const KEYS = {
  all: ['invoices'] as const,
  list: () => ['invoices', 'list'] as const,
  detail: (id: string) => ['invoices', 'detail', id] as const,
};

export function useInvoices() {
  return useQuery({
    queryKey: KEYS.list(),
    queryFn: listInvoices,
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: KEYS.detail(id ?? ''),
    queryFn: () => getInvoice(id!),
    enabled: Boolean(id),
  });
}

export function useInvoiceLookup() {
  const { data } = useInvoices();
  return {
    byId: (id: string | undefined): Invoice | undefined => {
      if (!id) return undefined;
      return data?.find((i) => i.id === id);
    },
    bySupplier: (supplierId: string | undefined): Invoice[] => {
      if (!supplierId) return [];
      return (data ?? []).filter((i) => i.supplierId === supplierId);
    },
    byPO: (poId: string | undefined): Invoice[] => {
      if (!poId) return [];
      return (data ?? []).filter((i) => i.poId === poId);
    },
  };
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (record: Invoice) => createInvoice(record),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Invoice> }) => updateInvoice(id, patch),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: KEYS.list() });
    },
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteInvoice(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}
