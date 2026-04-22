import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { WorkflowStepDetail } from '@/data/workflow-step-details';
import {
  listWorkflowStepDetails,
  listStepDetailsForRequest,
  saveWorkflowStepDetail,
  deleteWorkflowStepDetail,
} from '../workflow-step-details';

const KEYS = {
  all: ['workflow-step-details'] as const,
  list: () => ['workflow-step-details', 'list'] as const,
  byRequest: (requestId: string) => ['workflow-step-details', 'request', requestId] as const,
};

export function useWorkflowStepDetails() {
  return useQuery({ queryKey: KEYS.list(), queryFn: listWorkflowStepDetails });
}

export function useWorkflowStepDetailsForRequest(requestId: string | undefined) {
  return useQuery({
    queryKey: KEYS.byRequest(requestId ?? ''),
    queryFn: () => listStepDetailsForRequest(requestId!),
    enabled: Boolean(requestId),
  });
}

export function useSaveWorkflowStepDetail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (record: WorkflowStepDetail) => saveWorkflowStepDetail(record),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useDeleteWorkflowStepDetail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, stage }: { requestId: string; stage: string }) =>
      deleteWorkflowStepDetail(requestId, stage),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}
