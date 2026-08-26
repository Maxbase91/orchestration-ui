// TanStack Query bindings for support tickets.
//
// Mutations invalidate both the ticket lists and the affected ticket's thread, so
// the inbox count, the queue row and an open detail drawer all refresh from one
// action rather than drifting apart.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addTicketLink,
  addTicketResponse,
  assignTicket,
  createTicket,
  getTicket,
  listTicketLinks,
  listTicketResponses,
  listTickets,
  listTicketsForObject,
  removeTicketLink,
  setTicketStatus,
  type AddResponseInput,
  type AddTicketLinkInput,
  type CreateTicketInput,
  type ListTicketsOptions,
} from '../tickets';
import type { TicketLinkType, TicketStatus } from '@/data/types';

const KEYS = {
  all: ['tickets'] as const,
  list: (userName: string, opts: ListTicketsOptions) => ['tickets', 'list', userName, opts] as const,
  byId: (id: string) => ['tickets', id] as const,
  responses: (id: string, includeInternal: boolean) =>
    ['tickets', id, 'responses', includeInternal] as const,
  links: (id: string) => ['tickets', id, 'links'] as const,
  forObject: (type: string, id: string) => ['tickets', 'for-object', type, id] as const,
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
    mutationFn: ({ id, owner, actor }: {
      id: string;
      owner: { id: string; name: string } | null;
      actor?: { id: string; name: string };
    }) => assignTicket(id, owner, actor),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useSetTicketStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, resolution, actor }: {
      id: string;
      status: TicketStatus;
      resolution?: string;
      actor?: { id: string; name: string };
    }) => setTicketStatus(id, status, resolution, actor),
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

/** References from a ticket to requests, POs, suppliers, contracts or invoices. */
export function useTicketLinks(id: string | undefined) {
  return useQuery({
    queryKey: KEYS.links(id ?? ''),
    queryFn: () => listTicketLinks(id!),
    enabled: Boolean(id),
  });
}

export function useAddTicketLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddTicketLinkInput) => addTicketLink(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useRemoveTicketLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ linkId, ctx }: {
      linkId: string;
      ctx?: { ticketId: string; actor: { id: string; name: string }; description: string };
    }) => removeTicketLink(linkId, ctx),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

/**
 * Tickets raised against a given object — powers a "support history" panel on a
 * request, PO or supplier page.
 */
export function useTicketsForObject(objectType: TicketLinkType, objectId: string | undefined) {
  return useQuery({
    queryKey: KEYS.forObject(objectType, objectId ?? ''),
    queryFn: () => listTicketsForObject(objectType, objectId!),
    enabled: Boolean(objectId),
  });
}
