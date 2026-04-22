import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AIAgent } from '@/data/types';
import { listAiAgents, getAiAgent, saveAiAgent, deleteAiAgent } from '../ai-agents';

const KEYS = {
  all: ['ai-agents'] as const,
  list: () => ['ai-agents', 'list'] as const,
  detail: (id: string) => ['ai-agents', 'detail', id] as const,
};

export function useAiAgents() {
  return useQuery({ queryKey: KEYS.list(), queryFn: listAiAgents });
}

export function useAiAgent(id: string | undefined) {
  return useQuery({
    queryKey: KEYS.detail(id ?? ''),
    queryFn: () => getAiAgent(id!),
    enabled: Boolean(id),
  });
}

export function useSaveAiAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (record: AIAgent) => saveAiAgent(record),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useDeleteAiAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAiAgent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}
