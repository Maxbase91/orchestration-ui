import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RoutingRule } from '@/data/types';
import {
  listRoutingRules,
  getRoutingRule,
  saveRoutingRule,
  deleteRoutingRule,
} from '../routing-rules';

const KEYS = {
  all: ['routing-rules'] as const,
  list: () => ['routing-rules', 'list'] as const,
  detail: (id: string) => ['routing-rules', 'detail', id] as const,
};

export function useRoutingRules() {
  return useQuery({ queryKey: KEYS.list(), queryFn: listRoutingRules });
}

export function useRoutingRule(id: string | undefined) {
  return useQuery({
    queryKey: KEYS.detail(id ?? ''),
    queryFn: () => getRoutingRule(id!),
    enabled: Boolean(id),
  });
}

export function useSaveRoutingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (record: RoutingRule) => saveRoutingRule(record),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useDeleteRoutingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRoutingRule(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}
