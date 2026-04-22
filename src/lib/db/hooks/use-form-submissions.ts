import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FormSubmission } from '@/data/form-submissions';
import {
  listFormSubmissions,
  listSubmissionsByRequest,
  createFormSubmission,
} from '../form-submissions';

const KEYS = {
  all: ['form-submissions'] as const,
  list: () => ['form-submissions', 'list'] as const,
  byRequest: (requestId: string) => ['form-submissions', 'request', requestId] as const,
};

export function useFormSubmissions() {
  return useQuery({
    queryKey: KEYS.list(),
    queryFn: listFormSubmissions,
  });
}

export function useSubmissionsByRequest(requestId: string | undefined) {
  return useQuery({
    queryKey: KEYS.byRequest(requestId ?? ''),
    queryFn: () => listSubmissionsByRequest(requestId!),
    enabled: Boolean(requestId),
  });
}

/**
 * Pair with `useFormSubmissions()` in the same component for a sync lookup
 * filtered by request + stage.
 */
export function useSubmissionLookup() {
  const { data } = useFormSubmissions();
  return {
    forRequest: (requestId: string | undefined) =>
      !requestId ? [] : (data ?? []).filter((s) => s.requestId === requestId),
    forStage: (requestId: string | undefined, stage: string) =>
      !requestId
        ? []
        : (data ?? []).filter((s) => s.requestId === requestId && s.stage === stage),
  };
}

export function useCreateFormSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (record: FormSubmission) => createFormSubmission(record),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: KEYS.byRequest(variables.requestId) });
      qc.invalidateQueries({ queryKey: KEYS.list() });
    },
  });
}
