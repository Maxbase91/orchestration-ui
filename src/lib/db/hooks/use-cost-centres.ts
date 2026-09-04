import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CostCentre } from '@/lib/db/cost-centres';
import { listCostCentres, upsertCostCentre, deleteCostCentre } from '@/lib/db/cost-centres';

const KEYS = {
  all: ['cost-centres'] as const,
  list: () => ['cost-centres', 'list'] as const,
};

export function useCostCentres() {
  return useQuery({ queryKey: KEYS.list(), queryFn: listCostCentres, staleTime: 5 * 60 * 1000 });
}

export function useUpsertCostCentre() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (centre: CostCentre) => upsertCostCentre(centre),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useDeleteCostCentre() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCostCentre(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}
