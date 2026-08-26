// TanStack Query hooks over lib/db/sourcing-events (RFx events). Query keys
// live under the ['sourcing-events'] prefix; mutations invalidate the whole
// prefix. No delete hook — events are closed/awarded, not removed.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SourcingEvent } from '@/lib/db/sourcing-events';
import {
  listSourcingEvents,
  listSourcingEventsForRequest,
  getSourcingEvent,
  createSourcingEvent,
  updateSourcingEvent,
} from '@/lib/db/sourcing-events';

const KEYS = {
  all: ['sourcing-events'] as const,
  list: () => ['sourcing-events', 'list'] as const,
  detail: (id: string) => ['sourcing-events', 'detail', id] as const,
  forRequest: (requestId: string) => ['sourcing-events', 'request', requestId] as const,
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

/** Events raised from a request — powers the request's Related tab. */
export function useSourcingEventsForRequest(requestId: string | undefined) {
  return useQuery({
    queryKey: KEYS.forRequest(requestId ?? ''),
    queryFn: () => listSourcingEventsForRequest(requestId!),
    enabled: Boolean(requestId),
  });
}

export function useCreateSourcingEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (e: Omit<SourcingEvent, 'createdAt' | 'updatedAt'>) => createSourcingEvent(e),
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
