// Data access for sourcing_responses — one row per invited supplier per event.
//
// The row is created at *invitation* time, not when the supplier replies: it is
// the invitation and the response in one record, which is what lets the buyer
// see "invited but not yet viewed" and lets the portal show a supplier only the
// events they were actually asked to bid on.
//
// Until now nothing in the codebase touched this table — the New Event wizard
// collected a supplier selection and discarded it on publish, so the picker was
// decorative and the table stayed empty.
//
// Two invariants are enforced by the database rather than here, because the UI
// is the wrong place for them: UNIQUE (event_id, supplier_id) makes re-inviting
// idempotent, and a partial unique index on (event_id) WHERE awarded makes
// one-award-per-event structural.

import { supabase } from '@/lib/supabase-client';
import { createAuditEntry } from './audit-entries';
import { createNotification } from './notifications';

const TABLE = 'sourcing_responses';

/** Where a supplier has got to with an invitation. */
export type SourcingResponseStatus = 'not-viewed' | 'viewed' | 'responded' | 'declined';

export interface SourcingResponse {
  id: string;
  eventId: string;
  supplierId: string;
  supplierName: string;
  status: SourcingResponseStatus;
  invitedAt: string;
  viewedAt?: string;
  submittedAt?: string;
  responseDate?: string;
  /** Supplier-submitted commercials. */
  price?: number;
  currency: string;
  leadTimeDays?: number;
  narrative: string;
  /** Buyer-side evaluation: criterionId -> 1..5. */
  scores: Record<string, number>;
  weightedTotal?: number;
  shortlisted: boolean;
  awarded: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ResponseRow {
  id: string;
  event_id: string;
  supplier_id: string;
  supplier_name: string;
  status: string;
  invited_at: string;
  viewed_at: string | null;
  submitted_at: string | null;
  response_date: string | null;
  price: number | null;
  currency: string | null;
  lead_time_days: number | null;
  narrative: string | null;
  scores: Record<string, number> | null;
  weighted_total: number | null;
  shortlisted: boolean;
  awarded: boolean;
  created_at: string;
  updated_at: string;
}

function mapRow(row: ResponseRow): SourcingResponse {
  return {
    id: row.id,
    eventId: row.event_id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    status: (row.status as SourcingResponseStatus) ?? 'not-viewed',
    invitedAt: row.invited_at,
    currency: row.currency ?? 'EUR',
    narrative: row.narrative ?? '',
    scores: row.scores ?? {},
    shortlisted: row.shortlisted,
    awarded: row.awarded,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.viewed_at ? { viewedAt: row.viewed_at } : {}),
    ...(row.submitted_at ? { submittedAt: row.submitted_at } : {}),
    ...(row.response_date ? { responseDate: row.response_date } : {}),
    ...(row.price != null ? { price: row.price } : {}),
    ...(row.lead_time_days != null ? { leadTimeDays: row.lead_time_days } : {}),
    ...(row.weighted_total != null ? { weightedTotal: row.weighted_total } : {}),
  };
}

// Audit and notification are best-effort, matching the ticket module: a failed
// audit row is a reporting gap, whereas refusing an invitation because the audit
// write failed would block the person running the event.
async function auditEvent(
  eventId: string,
  action: string,
  detail: string,
  actor: { id: string; name: string },
): Promise<void> {
  try {
    await createAuditEntry({
      timestamp: new Date().toISOString(),
      userId: actor.id,
      userName: actor.name,
      action,
      objectType: 'sourcing-event',
      objectId: eventId,
      detail,
      type: 'human',
    });
  } catch { /* non-fatal — see note above */ }
}

async function notify(relatedId: string, title: string, description: string, actionUrl: string): Promise<void> {
  try {
    await createNotification({
      id: `NTF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'status-update',
      title,
      description,
      timestamp: new Date().toISOString(),
      isRead: false,
      actionUrl,
      relatedId,
    });
  } catch { /* non-fatal — see note above */ }
}

/**
 * Invite suppliers to an event. Idempotent: re-publishing an event upserts on
 * (event_id, supplier_id) rather than creating a second invitation, so a user
 * who edits and re-publishes does not spam the same supplier twice.
 */
export async function inviteSuppliers(
  eventId: string,
  suppliers: { id: string; name: string }[],
  actor?: { id: string; name: string },
): Promise<SourcingResponse[]> {
  if (suppliers.length === 0) return [];

  const rows = suppliers.map((s) => ({
    id: `SRS-${eventId}-${s.id}`,
    event_id: eventId,
    supplier_id: s.id,
    supplier_name: s.name,
    status: 'not-viewed',
  }));

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(rows, { onConflict: 'event_id,supplier_id', ignoreDuplicates: true })
    .select('*');
  if (error) throw error;

  if (actor) {
    await auditEvent(eventId, 'sourcing.suppliers.invited', `Invited ${suppliers.length} supplier(s)`, actor);
  }
  return (data ?? []).map((r) => mapRow(r as ResponseRow));
}

/** All responses on an event — the buyer-side view. */
export async function listResponsesForEvent(eventId: string): Promise<SourcingResponse[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('event_id', eventId)
    .order('supplier_name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapRow(r as ResponseRow));
}

/**
 * A supplier's own invitations — the portal view.
 *
 * The `.eq('supplier_id')` is the entitlement boundary, and it lives here rather
 * than in the component: RLS is `USING (true)`, so a component-level filter
 * would be a display convention. A supplier must never receive another
 * supplier's row, and the caller must not join the event's criteria or budget
 * onto this — those are buyer-side.
 */
export async function listInvitationsForSupplier(supplierId: string): Promise<SourcingResponse[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('supplier_id', supplierId)
    .order('invited_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => mapRow(r as ResponseRow));
}

async function patch(id: string, values: Record<string, unknown>): Promise<SourcingResponse> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapRow(data as ResponseRow);
}

/**
 * Record that the supplier opened the invitation. Only advances from
 * `not-viewed`, so re-opening a submitted response cannot regress its status.
 */
export async function markResponseViewed(response: SourcingResponse): Promise<SourcingResponse> {
  if (response.status !== 'not-viewed') return response;
  return patch(response.id, { status: 'viewed', viewed_at: new Date().toISOString() });
}

export interface SubmitResponseInput {
  price?: number;
  currency?: string;
  leadTimeDays?: number;
  narrative?: string;
}

/** Supplier submits their bid. Notifies the event owner. */
export async function submitResponse(
  response: SourcingResponse,
  input: SubmitResponseInput,
): Promise<SourcingResponse> {
  const now = new Date().toISOString();
  const updated = await patch(response.id, {
    status: 'responded',
    submitted_at: now,
    response_date: now.slice(0, 10),
    ...(input.price != null ? { price: input.price } : {}),
    ...(input.currency ? { currency: input.currency } : {}),
    ...(input.leadTimeDays != null ? { lead_time_days: input.leadTimeDays } : {}),
    ...(input.narrative ? { narrative: input.narrative } : {}),
  });

  await notify(
    response.eventId,
    `${response.supplierName} responded to ${response.eventId}`,
    input.narrative?.slice(0, 140) ?? 'A supplier submitted their response.',
    `/sourcing/${response.eventId}`,
  );
  return updated;
}

/** Persist buyer-side scores and the denormalised weighted total. */
export async function saveResponseScores(
  id: string,
  scores: Record<string, number>,
  weightedTotal: number,
): Promise<SourcingResponse> {
  return patch(id, { scores, weighted_total: weightedTotal });
}

export async function setShortlisted(id: string, shortlisted: boolean): Promise<SourcingResponse> {
  return patch(id, { shortlisted });
}
