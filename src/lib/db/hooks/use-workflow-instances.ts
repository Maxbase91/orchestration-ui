import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getWorkflowInstanceForRequest } from '@/lib/db/workflow-instances';
import { advanceWorkflow } from '@/lib/workflow/engine';

const KEYS = {
  all: ['workflow-instances'] as const,
  byRequest: (requestId: string) => ['workflow-instances', 'request', requestId] as const,
};

export function useWorkflowInstance(requestId: string | undefined) {
  return useQuery({
    queryKey: KEYS.byRequest(requestId ?? ''),
    queryFn: () => getWorkflowInstanceForRequest(requestId!),
    enabled: Boolean(requestId),
    refetchInterval: 5000, // poll every 5s to pick up server-side changes
  });
}

export function useAdvanceWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, outcome }: { requestId: string; outcome?: string }) =>
      advanceWorkflow(requestId, outcome),
    onSuccess: (_data, { requestId }) => {
      qc.invalidateQueries({ queryKey: KEYS.byRequest(requestId) });
      qc.invalidateQueries({ queryKey: ['requests'] });
      qc.invalidateQueries({ queryKey: ['approval-entries'] });
    },
  });
}
