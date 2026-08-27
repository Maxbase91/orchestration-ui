// Data access for sourcing_events (RFP/RFQ/RFI events run in the Sourcing area).
// Reads flow through use-sourcing-events.ts hooks.
//
// An event is normally raised *from* a procurement request sitting in the
// sourcing stage — `requestId` is that link. It is nullable because a standing
// category event (a framework refresh) legitimately has no originating request.
import { supabase } from '@/lib/supabase-client';

/** One scored dimension of an RFx. Weights across an event must total 100. */
export interface SourcingCriterion {
  id: string;
  label: string;
  weight: number;
}

export interface SourcingEvent {
  id: string;
  title: string;
  category: string;
  type: string;
  status: 'draft' | 'published' | 'in-evaluation' | 'award-pending' | 'completed' | 'cancelled';
  budget?: number;
  deadline?: string;
  publishDate?: string;
  evaluationDate?: string;
  awardDate?: string;
  ownerId?: string;
  description: string;
  /** The request this event was raised from, when there is one. */
  requestId?: string;
  /** Free-text scope lines captured in the wizard. */
  requirements: string[];
  /** Weighted evaluation criteria; the scoring matrix reads these. */
  criteria: SourcingCriterion[];
  budgetMin?: number;
  startDate?: string;
  currency: string;
  /** Set on award, alongside the winning response. */
  awardedSupplierId?: string;
  createdAt: string;
  updatedAt: string;
}

const TABLE = 'sourcing_events';

function mapRow(row: Record<string, unknown>): SourcingEvent {
  return {
    id: row.id as string,
    title: row.title as string,
    category: (row.category as string) ?? '',
    type: (row.type as string) ?? 'RFP',
    status: (row.status as SourcingEvent['status']) ?? 'draft',
    budget: row.budget as number | undefined,
    deadline: row.deadline as string | undefined,
    publishDate: row.publish_date as string | undefined,
    evaluationDate: row.evaluation_date as string | undefined,
    awardDate: row.award_date as string | undefined,
    ownerId: row.owner_id as string | undefined,
    description: (row.description as string) ?? '',
    requestId: row.request_id as string | undefined,
    requirements: (row.requirements as string[]) ?? [],
    criteria: (row.criteria as SourcingCriterion[]) ?? [],
    budgetMin: row.budget_min as number | undefined,
    startDate: row.start_date as string | undefined,
    currency: (row.currency as string) ?? 'EUR',
    awardedSupplierId: row.awarded_supplier_id as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// Partial patch mapper — only includes fields the caller actually set, so an
// update() never clobbers unrelated columns with undefined.
function mapToDb(e: Partial<SourcingEvent>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (e.title !== undefined) row.title = e.title;
  if (e.category !== undefined) row.category = e.category;
  if (e.type !== undefined) row.type = e.type;
  if (e.status !== undefined) row.status = e.status;
  if (e.budget !== undefined) row.budget = e.budget;
  if (e.deadline !== undefined) row.deadline = e.deadline;
  if (e.publishDate !== undefined) row.publish_date = e.publishDate;
  if (e.evaluationDate !== undefined) row.evaluation_date = e.evaluationDate;
  if (e.awardDate !== undefined) row.award_date = e.awardDate;
  if (e.ownerId !== undefined) row.owner_id = e.ownerId;
  if (e.description !== undefined) row.description = e.description;
  if (e.requestId !== undefined) row.request_id = e.requestId;
  if (e.requirements !== undefined) row.requirements = e.requirements;
  if (e.criteria !== undefined) row.criteria = e.criteria;
  if (e.budgetMin !== undefined) row.budget_min = e.budgetMin;
  if (e.startDate !== undefined) row.start_date = e.startDate;
  if (e.currency !== undefined) row.currency = e.currency;
  if (e.awardedSupplierId !== undefined) row.awarded_supplier_id = e.awardedSupplierId;
  row.updated_at = new Date().toISOString();
  return row;
}

export async function listSourcingEvents(): Promise<SourcingEvent[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getSourcingEvent(id: string): Promise<SourcingEvent | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapRow(data) : null;
}

/**
 * Next readable event id (SRC-0001, SRC-0002, …) from a Postgres sequence.
 *
 * Falls back to a timestamp id if the RPC is unavailable — an environment
 * provisioned before the sequence existed. A non-sequential id beats refusing
 * to create the event.
 */
export async function nextSourcingEventId(): Promise<string> {
  const { data, error } = await supabase.rpc('next_sourcing_event_id');
  if (error || !data) return `SRC-${Date.now().toString().slice(-8)}`;
  return String(data);
}

/**
 * Create an event. The caller supplies the id (mirroring createPurchaseOrder, so
 * the caller can navigate to it immediately); omit it and the table's
 * gen_random_uuid() default produces an unreadable UUID.
 */
export async function createSourcingEvent(
  event: Omit<SourcingEvent, 'createdAt' | 'updatedAt'> | Omit<SourcingEvent, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<SourcingEvent> {
  const row = mapToDb(event as Partial<SourcingEvent>);
  if ('id' in event && event.id) row.id = event.id;
  const { data, error } = await supabase.from(TABLE).insert(row).select('*').single();
  if (error) throw error;
  return mapRow(data);
}

/**
 * The supplier-facing view of an event. Buyer-side fields are excluded from the
 * SELECT, not merely left unrendered — `criteria`, their weights and `budget`
 * would otherwise sit in the network payload of a page an external party loads.
 *
 * Returns null unless the caller holds an invitation, so an uninvited supplier
 * cannot read an event by guessing its id. Both rules live here rather than in
 * the component because RLS is `USING (true)`.
 */
export interface SupplierEventView {
  id: string;
  title: string;
  description: string;
  type: string;
  status: SourcingEvent['status'];
  deadline?: string;
  requirements: string[];
}

export async function getSourcingEventForSupplier(
  eventId: string,
  supplierId: string,
): Promise<SupplierEventView | null> {
  const { data: invite, error: inviteError } = await supabase
    .from('sourcing_responses')
    .select('id')
    .eq('event_id', eventId)
    .eq('supplier_id', supplierId)
    .maybeSingle();
  if (inviteError) throw inviteError;
  if (!invite) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .select('id, title, description, type, status, deadline, requirements')
    .eq('id', eventId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) ?? '',
    type: (row.type as string) ?? 'RFP',
    status: (row.status as SourcingEvent['status']) ?? 'draft',
    requirements: (row.requirements as string[]) ?? [],
    ...(row.deadline ? { deadline: row.deadline as string } : {}),
  };
}

/** Events raised from a given request — powers the request's Related tab. */
export async function listSourcingEventsForRequest(requestId: string): Promise<SourcingEvent[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function updateSourcingEvent(id: string, patch: Partial<SourcingEvent>): Promise<SourcingEvent> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(mapToDb(patch))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapRow(data);
}

/**
 * Hard-delete an event. Exists only for the Admin → Database browser.
 *
 * No application flow calls this — an event is closed, awarded or cancelled,
 * never removed, which is why there is no delete hook beside the others. The
 * admin browser is the one place a genuinely bad row has to be removable, and
 * a delete that only removed the local copy would be worse than none. Note the
 * FK on sourcing_responses cascades: deleting an event deletes its invitations
 * and their submitted bids with it.
 */
export async function deleteSourcingEvent(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
