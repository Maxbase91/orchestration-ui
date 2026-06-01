import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SlaTarget } from '@/lib/db/sla-targets';
import { listSlaTargets, upsertSlaTarget, resolveSla } from '@/lib/db/sla-targets';

const KEYS = {
  all: ['sla-targets'] as const,
  list: () => ['sla-targets', 'list'] as const,
};

export function useSlaTargets() {
  return useQuery({ queryKey: KEYS.list(), queryFn: listSlaTargets, staleTime: 10 * 60 * 1000 });
}

/** Convenience hook: returns the SLA in days for a single stage. */
export function useSlaForStage(stage: string, channel = 'default'): number {
  const { data = [] } = useSlaTargets();
  return resolveSla(data, stage, channel);
}

export function useUpsertSlaTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (target: SlaTarget) => upsertSlaTarget(target),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}
