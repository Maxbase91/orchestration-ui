import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApprovalEntry } from '@/data/types';
import {
  listApprovals,
  getApproval,
  createApproval,
  updateApproval,
  deleteApproval,
} from '../approvals';

const KEYS = {
  all: ['approvals'] as const,
  list: () => ['approvals', 'list'] as const,
  detail: (id: string) => ['approvals', 'detail', id] as const,
};

export function useApprovals() {
  return useQuery({
    queryKey: KEYS.list(),
    queryFn: listApprovals,
  });
}

export function useApproval(id: string | undefined) {
  return useQuery({
    queryKey: KEYS.detail(id ?? ''),
    queryFn: () => getApproval(id!),
    enabled: Boolean(id),
  });
}

export function useApprovalLookup() {
  const { data } = useApprovals();
  return {
    byId: (id: string | undefined): ApprovalEntry | undefined => {
      if (!id) return undefined;
      return data?.find((a) => a.id === id);
    },
    byRequest: (requestId: string | undefined): ApprovalEntry[] => {
      if (!requestId) return [];
      return (data ?? []).filter((a) => a.requestId === requestId);
    },
    byApprover: (approverId: string | undefined): ApprovalEntry[] => {
      if (!approverId) return [];
      return (data ?? []).filter((a) => a.approverId === approverId);
    },
    pending: (): ApprovalEntry[] => (data ?? []).filter((a) => a.status === 'pending'),
  };
}

export function useCreateApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (record: ApprovalEntry) => createApproval(record),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useUpdateApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ApprovalEntry> }) =>
      updateApproval(id, patch),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: KEYS.list() });
    },
  });
}

export function useDeleteApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteApproval(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}
