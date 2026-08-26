// TanStack Query bindings for support tickets.
//
// Mutations invalidate both the ticket lists and the affected ticket's thread, so
// the inbox count, the queue row and an open detail drawer all refresh from one
// action rather than drifting apart.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addTicketResponse,
  assignTicket,
  createTicket,
  getTicket,
  listTicketResponses,
  listTickets,
  setTicketStatus,
  type AddResponseInput,
  type CreateTicketInput,
  type ListTicketsOptions,
} from '../tickets';
import type { TicketStatus } from '@/data/types';

const KEYS = {
  all: ['tickets'] as const,
  list: (userName: string, opts: ListTicketsOptions) => ['tickets', 'list', userName, opts] as const,
  byId: (id: string) => ['tickets', id] as const,
  responses: (id: string, includeInternal: boolean) =>
    ['tickets', id, 'responses', includeInternal] as const,
};

export function useTickets(userName: string, opts: ListTicketsOptions = {}) {
  return useQuery({
    queryKey: KEYS.list(userName, opts),
    queryFn: () => listTickets(userName, opts),
    enabled: Boolean(userName) || Boolean(opts.allTickets),
  });
}

export function useTicket(id: string | undefined) {
  return useQuery({
    queryKey: KEYS.byId(id ?? ''),
    queryFn: () => getTicket(id!),
    enabled: Boolean(id),
  });
}

export function useTicketResponses(id: string | undefined, includeInternal = false) {
  return useQuery({
    queryKey: KEYS.responses(id ?? '', includeInternal),
    queryFn: () => listTicketResponses(id!, { includeInternal }),
    enabled: Boolean(id),
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTicketInput) => createTicket(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useAssignTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, owner }: { id: string; owner: { id: string; name: string } | null }) =>
      assignTicket(id, owner),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useSetTicketStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, resolution }: { id: string; status: TicketStatus; resolution?: string }) =>
      setTicketStatus(id, status, resolution),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useAddTicketResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddResponseInput) => addTicketResponse(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}
