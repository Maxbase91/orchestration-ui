// TanStack Query bindings for sourcing responses (invitations + bids).
//
// Mutations invalidate the sourcing-events prefix as well as their own, because
// an event's headline response count is derived from these rows — invalidating
// only one leaves the list and the detail page disagreeing about the same event.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  applyAwardToRequest,
  awardResponse,
  inviteSuppliers,
  listAllResponses,
  listInvitationsForSupplier,
  listResponsesForEvent,
  markResponseViewed,
  saveResponseScores,
  setShortlisted,
  submitResponse,
  type SourcingResponse,
  type SubmitResponseInput,
} from '../sourcing-responses';
import type { AwardCandidate } from '@/lib/procurement/sourcing-award';
import type { SourcingEvent } from '../sourcing-events';

const KEYS = {
  all: ['sourcing-responses'] as const,
  forEvent: (eventId: string) => ['sourcing-responses', 'event', eventId] as const,
  forSupplier: (supplierId: string) => ['sourcing-responses', 'supplier', supplierId] as const,
};

/** Invalidate responses *and* events — the event's response count depends on these. */
function useResponseMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: ['sourcing-events'] });
    },
  });
}

/**
 * An award reaches past sourcing into the request, its stage timeline and the
 * workflow instance, so it needs a wider invalidation than useResponseMutation
 * gives — without these three the request header and lifecycle stepper keep
 * showing the pre-award state until a reload.
 */
function useAwardMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of [
        KEYS.all,
        ['sourcing-events'],
        ['requests'],
        ['stage-history'],
        ['workflow-instances'],
      ]) {
        qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}

/** Every invitation — used by the register to count suppliers per event. */
export function useAllSourcingResponses() {
  return useQuery({ queryKey: KEYS.all, queryFn: listAllResponses });
}

export function useResponsesForEvent(eventId: string | undefined) {
  return useQuery({
    queryKey: KEYS.forEvent(eventId ?? ''),
    queryFn: () => listResponsesForEvent(eventId!),
    enabled: Boolean(eventId),
  });
}

/** The portal view — a supplier's own invitations, scoped in the query. */
export function useInvitationsForSupplier(supplierId: string | undefined) {
  return useQuery({
    queryKey: KEYS.forSupplier(supplierId ?? ''),
    queryFn: () => listInvitationsForSupplier(supplierId!),
    enabled: Boolean(supplierId),
  });
}

export function useInviteSuppliers() {
  return useResponseMutation(
    ({ eventId, suppliers, actor }: {
      eventId: string;
      suppliers: { id: string; name: string }[];
      actor?: { id: string; name: string };
    }) => inviteSuppliers(eventId, suppliers, actor),
  );
}

export function useMarkResponseViewed() {
  return useResponseMutation((response: SourcingResponse) => markResponseViewed(response));
}

export function useSubmitResponse() {
  return useResponseMutation(
    ({ response, input }: { response: SourcingResponse; input: SubmitResponseInput }) =>
      submitResponse(response, input),
  );
}

export function useSaveResponseScores() {
  return useResponseMutation(
    ({ id, scores, weightedTotal }: { id: string; scores: Record<string, number>; weightedTotal: number }) =>
      saveResponseScores(id, scores, weightedTotal),
  );
}

export function useSetShortlisted() {
  return useResponseMutation(
    ({ id, shortlisted }: { id: string; shortlisted: boolean }) => setShortlisted(id, shortlisted),
  );
}

export function useAwardResponse() {
  return useAwardMutation(
    ({ event, responses, responseId, actor }: {
      event: Pick<SourcingEvent, 'id' | 'status' | 'requestId' | 'awardedSupplierId'>;
      responses: SourcingResponse[];
      responseId: string;
      actor: { id: string; name: string };
    }) => awardResponse(event, responses, responseId, actor),
  );
}

/** Repair action for a half-applied award — see applyAwardToRequest's comment. */
export function useApplyAwardToRequest() {
  return useAwardMutation(
    ({ requestId, winner, actor }: {
      requestId: string;
      winner: AwardCandidate;
      actor: { id: string; name: string };
    }) => applyAwardToRequest(requestId, winner, actor),
  );
}
