import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RiskAssessment } from '@/data/types';
import {
  listRiskAssessments,
  getRiskAssessment,
  createRiskAssessment,
  updateRiskAssessment,
  deleteRiskAssessment,
  findMatchingRiskAssessments,
} from '../risk-assessments';

const KEYS = {
  all: ['risk-assessments'] as const,
  list: () => ['risk-assessments', 'list'] as const,
  detail: (id: string) => ['risk-assessments', 'detail', id] as const,
  matching: (supplierId?: string, contractId?: string) =>
    ['risk-assessments', 'matching', supplierId ?? '', contractId ?? ''] as const,
};

export function useRiskAssessments() {
  return useQuery({
    queryKey: KEYS.list(),
    queryFn: listRiskAssessments,
  });
}

export function useRiskAssessment(id: string | undefined) {
  return useQuery({
    queryKey: KEYS.detail(id ?? ''),
    queryFn: () => getRiskAssessment(id!),
    enabled: Boolean(id),
  });
}

export function useMatchingRiskAssessments(params: { supplierId?: string; contractId?: string }) {
  return useQuery({
    queryKey: KEYS.matching(params.supplierId, params.contractId),
    queryFn: () => findMatchingRiskAssessments(params),
    enabled: Boolean(params.supplierId || params.contractId),
  });
}

/**
 * Synchronous lookup over the cached risk-assessments list. Pair with
 * `useRiskAssessments()` so the cache is primed.
 */
export function useRiskAssessmentLookup() {
  const { data } = useRiskAssessments();
  return (id: string | undefined): RiskAssessment | undefined => {
    if (!id) return undefined;
    return data?.find((r) => r.id === id);
  };
}

export function useCreateRiskAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (record: RiskAssessment) => createRiskAssessment(record),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useUpdateRiskAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<RiskAssessment> }) =>
      updateRiskAssessment(id, patch),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: KEYS.list() });
    },
  });
}

export function useDeleteRiskAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRiskAssessment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}
