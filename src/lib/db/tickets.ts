// Support-ticket data access. The platform's own store is the system of record —
// there is no upstream service desk in this release.
//
// Every ticket read and write funnels through here. Before this module the three
// intake paths each rolled their own: the Contact Support form and api/chat.ts
// both inserted directly (duplicating a racy ID generator), and the assistant's
// mock handover appended to an in-memory array that was lost on refresh.
//
// Two rules this module exists to enforce, both of which belong in the query
// rather than a component: a requester only ever sees their own tickets, and
// internal notes never reach a requester. RLS is currently "allow all", so a
// component-level filter would be a display convention, not a boundary.

import { supabase } from '@/lib/supabase-client';
import { createAuditEntry } from './audit-entries';
import { createNotification } from './notifications';
import { computeDueAt, isSlaPaused, type TicketSlaTarget } from '@/lib/procurement/ticket-sla';
import type {
  Ticket,
  TicketLink,
  TicketLinkType,
  TicketResponse,
  TicketStatus,
} from '@/data/types';

const TABLE = 'tickets';
const RESPONSES_TABLE = 'ticket_responses';
const LINKS_TABLE = 'ticket_links';

interface TicketRow {
  id: string;
  summary: string;
  context: string;
  status: string;
  created_at: string;
  created_by: string;
  category: string | null;
  priority: string | null;
  owner_id: string | null;
  owner_name: string | null;
  source: string | null;
  transcript: string | null;
  due_at: string | null;
  updated_at: string | null;
  resolved_at: string | null;
  resolution: string | null;
}

interface TicketResponseRow {
  id: string;
  ticket_id: string;
  author_id: string | null;
  author_name: string | null;
  author_initials: string | null;
  body: string;
  is_internal: boolean;
  created_at: string;
}

function mapDbToTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    summary: row.summary,
    context: row.context,
    status: row.status as TicketStatus,
    createdAt: row.created_at,
    createdBy: row.created_by,
    ...(row.category ? { category: row.category } : {}),
    ...(row.priority ? { priority: row.priority } : {}),
    ...(row.owner_id ? { ownerId: row.owner_id } : {}),
    ...(row.owner_name ? { ownerName: row.owner_name } : {}),
    ...(row.source ? { source: row.source } : {}),
    ...(row.transcript ? { transcript: row.transcript } : {}),
    ...(row.due_at ? { dueAt: row.due_at } : {}),
    ...(row.updated_at ? { updatedAt: row.updated_at } : {}),
    ...(row.resolved_at ? { resolvedAt: row.resolved_at } : {}),
    ...(row.resolution ? { resolution: row.resolution } : {}),
  };
}

function mapDbToResponse(row: TicketResponseRow): TicketResponse {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    body: row.body,
    isInternal: row.is_internal,
    createdAt: row.created_at,
    ...(row.author_id ? { authorId: row.author_id } : {}),
    ...(row.author_name ? { authorName: row.author_name } : {}),
    ...(row.author_initials ? { authorInitials: row.author_initials } : {}),
  };
}

/**
 * Next ticket ID from the Postgres sequence.
 *
 * Falls back to a timestamp-suffixed ID if the RPC is unavailable — an
 * environment provisioned before the sequence existed. A collision-free but
 * non-sequential ID beats failing the user's submission outright.
 */
async function nextTicketId(): Promise<string> {
  const { data, error } = await supabase.rpc('next_ticket_id');
  if (error || !data) return `TKT-${Date.now().toString().slice(-8)}`;
  return String(data);
}

export interface CreateTicketInput {
  summary: string;
  context: string;
  createdBy: string;
  category?: string;
  priority?: string;
  source?: 'form' | 'assistant';
  /** Verbatim conversation, when raised from the assistant. */
  transcript?: string;
}

/**
 * SLA targets for tickets, from the shared sla_targets table (stage 'ticket',
 * channel = priority). Read at create time so a target changed in admin applies
 * to new tickets without a deploy.
 */
async function loadTicketSlaTargets(): Promise<TicketSlaTarget[]> {
  const { data, error } = await supabase
    .from('sla_targets')
    .select('channel, hours, days')
    .eq('stage', 'ticket');
  if (error || !data) return [];
  return data
    .map((r) => {
      const row = r as { channel: string; hours: number | null; days: number | null };
      // `hours` wins where set; `days` is the table's original unit and still
      // the fallback for a row that predates ticket SLAs.
      const hours = row.hours ?? (row.days != null ? row.days * 24 : null);
      return hours != null ? { channel: row.channel, hours } : null;
    })
    .filter((t): t is TicketSlaTarget => t !== null);
}

export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  const id = await nextTicketId();
  const targets = await loadTicketSlaTargets();
  const dueAt = computeDueAt(new Date(), input.priority, targets);

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      id,
      summary: input.summary,
      context: input.context,
      status: 'open',
      created_by: input.createdBy,
      source: input.source ?? 'form',
      due_at: dueAt,
      ...(input.category ? { category: input.category } : {}),
      ...(input.priority ? { priority: input.priority } : {}),
      ...(input.transcript ? { transcript: input.transcript } : {}),
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToTicket(data as unknown as TicketRow);
}

export interface ListTicketsOptions {
  /** Agent view — pass only for roles entitled to the queue (see canWorkTickets). */
  allTickets?: boolean;
  status?: TicketStatus | 'all';
  /** 'unassigned' narrows to tickets with no owner — the default triage view. */
  ownerId?: string | 'unassigned';
  limit?: number;
}

export async function listTickets(
  userName: string,
  opts: ListTicketsOptions = {},
): Promise<Ticket[]> {
  let query = supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 50);

  // Entitlement first, so no later filter can widen it.
  if (!opts.allTickets) query = query.eq('created_by', userName);

  if (opts.status && opts.status !== 'all') query = query.eq('status', opts.status);
  if (opts.ownerId === 'unassigned') query = query.is('owner_id', null);
  else if (opts.ownerId) query = query.eq('owner_id', opts.ownerId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => mapDbToTicket(r as unknown as TicketRow));
}

export async function getTicket(id: string): Promise<Ticket | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapDbToTicket(data as unknown as TicketRow) : null;
}

async function patchTicket(id: string, patch: Record<string, unknown>): Promise<Ticket> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToTicket(data as unknown as TicketRow);
}

/**
 * Assign or reassign. A null owner returns the ticket to the unassigned queue.
 *
 * Forwarding is this plus a handover note, not a separate concept — one
 * ownership model rather than two. The caller writes the note as an internal
 * response so the reasoning stays on the thread.
 */
export async function assignTicket(
  id: string,
  owner: { id: string; name: string } | null,
  actor?: { id: string; name: string },
): Promise<Ticket> {
  const ticket = await patchTicket(id, {
    owner_id: owner?.id ?? null,
    owner_name: owner?.name ?? null,
  });

  if (actor) {
    await recordTicketAudit(
      id,
      owner ? 'ticket.assigned' : 'ticket.unassigned',
      owner ? `Assigned to ${owner.name}` : 'Returned to the unassigned queue',
      actor,
    );
  }
  if (owner && owner.id !== actor?.id) {
    await notifyTicket(id, `Ticket ${id} assigned to you`, ticket.summary);
  }
  return ticket;
}

/**
 * Move a ticket through its lifecycle.
 *
 * `resolved_at` is stamped on entry to a terminal state and cleared on reopen,
 * so time-to-resolve stays correct for a ticket that bounces back. A resolution
 * note is required to resolve — closing without one leaves the requester and the
 * next agent guessing what happened.
 */
export async function setTicketStatus(
  id: string,
  status: TicketStatus,
  resolution?: string,
  actor?: { id: string; name: string },
): Promise<Ticket> {
  if (status === 'resolved' && !resolution?.trim()) {
    throw new Error('A resolution note is required to resolve a ticket.');
  }
  const terminal = status === 'resolved' || status === 'cancelled';

  // Stop the clock by clearing due_at, and restart it from now on the way back.
  // A ticket returning from waiting-on-user deserves a fresh response window;
  // accumulating paused time would need another column and every transition to
  // maintain it.
  let dueAt: string | null | undefined;
  if (isSlaPaused(status)) {
    dueAt = null;
  } else {
    const current = await getTicket(id);
    if (!current?.dueAt) {
      dueAt = computeDueAt(new Date(), current?.priority, await loadTicketSlaTargets());
    }
  }

  const ticket = await patchTicket(id, {
    status,
    resolved_at: terminal ? new Date().toISOString() : null,
    ...(dueAt !== undefined ? { due_at: dueAt } : {}),
    ...(resolution?.trim() ? { resolution: resolution.trim() } : {}),
  });

  if (actor) {
    await recordTicketAudit(id, 'ticket.status.changed', `Status set to ${status}`, actor);
  }
  // The requester cares about terminal states and about being asked for
  // something; the intermediate agent-side shuffle is noise to them.
  if (terminal || status === 'waiting-on-user') {
    await notifyTicket(id, `Ticket ${id} is now ${status.replace(/-/g, ' ')}`, ticket.summary);
  }
  return ticket;
}

/**
 * Responses on a ticket. `includeInternal` is the entitlement gate — it must be
 * false for every requester-facing caller. Defaulting it to false means a caller
 * that forgets to pass it leaks nothing.
 */
export async function listTicketResponses(
  ticketId: string,
  opts: { includeInternal?: boolean } = {},
): Promise<TicketResponse[]> {
  let query = supabase
    .from(RESPONSES_TABLE)
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (!opts.includeInternal) query = query.eq('is_internal', false);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => mapDbToResponse(r as unknown as TicketResponseRow));
}

export interface AddResponseInput {
  ticketId: string;
  body: string;
  authorId?: string;
  authorName?: string;
  isInternal?: boolean;
}

export async function addTicketResponse(input: AddResponseInput): Promise<TicketResponse> {
  const initials = input.authorName
    ? input.authorName.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase()
    : undefined;

  const { data, error } = await supabase
    .from(RESPONSES_TABLE)
    .insert({
      id: `TRS-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ticket_id: input.ticketId,
      body: input.body,
      is_internal: input.isInternal ?? false,
      ...(input.authorId ? { author_id: input.authorId } : {}),
      ...(input.authorName ? { author_name: input.authorName } : {}),
      ...(initials ? { author_initials: initials } : {}),
    })
    .select('*')
    .single();
  if (error) throw error;

  // Touch the parent so the queue can sort by most-recently-active.
  await patchTicket(input.ticketId, {});

  if (input.authorId && input.authorName) {
    await recordTicketAudit(
      input.ticketId,
      input.isInternal ? 'ticket.note.added' : 'ticket.replied',
      input.isInternal ? 'Added an internal note' : 'Replied to the requester',
      { id: input.authorId, name: input.authorName },
    );
  }
  // Only a reply reaches the requester — an internal note must not notify them.
  if (!input.isInternal) {
    await notifyTicket(input.ticketId, `New reply on ticket ${input.ticketId}`, input.body.slice(0, 140));
  }

  return mapDbToResponse(data as unknown as TicketResponseRow);
}

// ── Audit + notification ─────────────────────────────────────────────────────
// Every state-changing action records who did what and tells the people who need
// to know. Both reuse existing generic tables: audit_entries is keyed by
// objectType/objectId, notifications by relatedId/actionUrl.
//
// Both are deliberately best-effort. A ticket that was assigned but whose audit
// row failed to write is a reporting gap; refusing the assignment because the
// audit failed would be worse for the person trying to work the queue.

async function recordTicketAudit(
  ticketId: string,
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
      objectType: 'ticket',
      objectId: ticketId,
      detail,
      type: 'human',
    });
  } catch {
    // Non-fatal — see note above.
  }
}

async function notifyTicket(
  ticketId: string,
  title: string,
  description: string,
): Promise<void> {
  try {
    await createNotification({
      id: `NTF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'status-update',
      title,
      description,
      timestamp: new Date().toISOString(),
      isRead: false,
      actionUrl: `/help/inbox`,
      relatedId: ticketId,
    });
  } catch {
    // Non-fatal — see note above.
  }
}

// ── References ───────────────────────────────────────────────────────────────

interface TicketLinkRow {
  id: string;
  ticket_id: string;
  object_type: string;
  object_id: string;
  label: string | null;
  created_at: string;
}

function mapDbToLink(row: TicketLinkRow): TicketLink {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    objectType: row.object_type as TicketLinkType,
    objectId: row.object_id,
    createdAt: row.created_at,
    ...(row.label ? { label: row.label } : {}),
  };
}

export async function listTicketLinks(ticketId: string): Promise<TicketLink[]> {
  const { data, error } = await supabase
    .from(LINKS_TABLE)
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapDbToLink(r as unknown as TicketLinkRow));
}

export interface AddTicketLinkInput {
  ticketId: string;
  objectType: TicketLinkType;
  objectId: string;
  label?: string;
  actor?: { id: string; name: string };
}

export async function addTicketLink(input: AddTicketLinkInput): Promise<TicketLink> {
  const { data, error } = await supabase
    .from(LINKS_TABLE)
    .insert({
      id: `TLK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ticket_id: input.ticketId,
      object_type: input.objectType,
      object_id: input.objectId,
      ...(input.label ? { label: input.label } : {}),
    })
    .select('*')
    .single();
  // A duplicate link is the same end state the user asked for, so return the
  // existing row rather than surfacing a unique-constraint error.
  if (error) {
    const existing = (await listTicketLinks(input.ticketId)).find(
      (l) => l.objectType === input.objectType && l.objectId === input.objectId,
    );
    if (existing) return existing;
    throw error;
  }

  if (input.actor) {
    await recordTicketAudit(
      input.ticketId,
      'ticket.link.added',
      `Linked ${input.objectType} ${input.objectId}`,
      input.actor,
    );
  }
  return mapDbToLink(data as unknown as TicketLinkRow);
}

export async function removeTicketLink(
  linkId: string,
  ctx?: { ticketId: string; actor: { id: string; name: string }; description: string },
): Promise<void> {
  const { error } = await supabase.from(LINKS_TABLE).delete().eq('id', linkId);
  if (error) throw error;
  if (ctx) {
    await recordTicketAudit(ctx.ticketId, 'ticket.link.removed', `Unlinked ${ctx.description}`, ctx.actor);
  }
}

/** Tickets referencing a given object — for a "support history" panel on that object. */
export async function listTicketsForObject(
  objectType: TicketLinkType,
  objectId: string,
): Promise<Ticket[]> {
  const { data, error } = await supabase
    .from(LINKS_TABLE)
    .select('ticket_id')
    .eq('object_type', objectType)
    .eq('object_id', objectId);
  if (error) throw error;

  const ids = (data ?? []).map((r) => (r as { ticket_id: string }).ticket_id);
  if (ids.length === 0) return [];

  const { data: rows, error: err2 } = await supabase
    .from(TABLE)
    .select('*')
    .in('id', ids)
    .order('created_at', { ascending: false });
  if (err2) throw err2;
  return (rows ?? []).map((r) => mapDbToTicket(r as unknown as TicketRow));
}
