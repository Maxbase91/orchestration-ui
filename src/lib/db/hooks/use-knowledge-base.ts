// TanStack Query hooks over lib/db/knowledge-base. Query keys live under the
// ['knowledge-base'] prefix; mutations invalidate the whole prefix.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listKnowledgeBase,
  saveKnowledgeBaseEntry,
  deleteKnowledgeBaseEntry,
  type KBEntry,
} from '../knowledge-base';
import { db } from '@/lib/db-client';
import { loadKnowledgeContextWith } from '../knowledge-core';

const KEYS = {
  all: ['knowledge-base'] as const,
  list: () => ['knowledge-base', 'list'] as const,
};

/**
 * The live configuration the entries link to (thresholds, approval chains,
 * preferred suppliers, category labels). Its own key rather than under the
 * policy or chain keys: it is read-only here and cheap to refetch, and tying
 * it to four other caches would make a stale figure depend on which screen
 * saved last.
 */
export function useKnowledgeContext() {
  return useQuery({ queryKey: ['knowledge-base', 'context'], queryFn: () => loadKnowledgeContextWith(db) });
}

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
