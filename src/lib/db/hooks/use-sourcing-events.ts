import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SourcingEvent } from '@/lib/db/sourcing-events';
import {
  listSourcingEvents,
  getSourcingEvent,
  createSourcingEvent,
  updateSourcingEvent,
} from '@/lib/db/sourcing-events';

const KEYS = {
  all: ['sourcing-events'] as const,
  list: () => ['sourcing-events', 'list'] as const,
  detail: (id: string) => ['sourcing-events', 'detail', id] as const,
};

export function useSourcingEvents() {
  return useQuery({ queryKey: KEYS.list(), queryFn: listSourcingEvents });
}

export function useSourcingEvent(id: string | undefined) {
  return useQuery({
    queryKey: KEYS.detail(id ?? ''),
    queryFn: () => getSourcingEvent(id!),
    enabled: Boolean(id),
  });
}

export function useCreateSourcingEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (e: Omit<SourcingEvent, 'id' | 'createdAt' | 'updatedAt'>) => createSourcingEvent(e),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useUpdateSourcingEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<SourcingEvent> }) =>
      updateSourcingEvent(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}
