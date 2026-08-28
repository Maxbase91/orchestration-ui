// TanStack Query hooks over lib/db/knowledge-base. Query keys live under the
// ['knowledge-base'] prefix; mutations invalidate the whole prefix.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listKnowledgeBase,
  saveKnowledgeBaseEntry,
  deleteKnowledgeBaseEntry,
  type KBEntry,
} from '../knowledge-base';

const KEYS = {
  all: ['knowledge-base'] as const,
  list: () => ['knowledge-base', 'list'] as const,
};

export function useKnowledgeBase() {
  return useQuery({ queryKey: KEYS.list(), queryFn: listKnowledgeBase });
}

export function useSaveKnowledgeBaseEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entry: KBEntry) => saveKnowledgeBaseEntry(entry),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useDeleteKnowledgeBaseEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteKnowledgeBaseEntry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}
