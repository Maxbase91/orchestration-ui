// TanStack Query hooks over lib/db/approval-chains. Query keys live under the
// ['approval-chains'] prefix; mutations invalidate the whole prefix.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApprovalChain } from '@/lib/db/approval-chains';
import { listApprovalChains, upsertApprovalChain, deleteApprovalChain } from '@/lib/db/approval-chains';

const KEYS = {
  all: ['approval-chains'] as const,
  list: () => ['approval-chains', 'list'] as const,
};

export function useApprovalChains() {
  return useQuery({
    queryKey: KEYS.list(),
    queryFn: listApprovalChains,
  });
}

export function useUpsertApprovalChain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (chain: ApprovalChain) => upsertApprovalChain(chain),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useDeleteApprovalChain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteApprovalChain(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}
