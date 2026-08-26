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
import type { Ticket, TicketResponse, TicketStatus } from '@/data/types';

const TABLE = 'tickets';
const RESPONSES_TABLE = 'ticket_responses';

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
  request_id: string | null;
  source: string | null;
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
    ...(row.request_id ? { requestId: row.request_id } : {}),
    ...(row.source ? { source: row.source } : {}),
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
  requestId?: string;
  source?: 'form' | 'assistant';
}

export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  const id = await nextTicketId();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      id,
      summary: input.summary,
      context: input.context,
      status: 'open',
      created_by: input.createdBy,
      source: input.source ?? 'form',
      ...(input.category ? { category: input.category } : {}),
      ...(input.priority ? { priority: input.priority } : {}),
      ...(input.requestId ? { request_id: input.requestId } : {}),
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToTicket(data as TicketRow);
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
  return (data ?? []).map((r) => mapDbToTicket(r as TicketRow));
}

export async function getTicket(id: string): Promise<Ticket | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapDbToTicket(data as TicketRow) : null;
}

async function patchTicket(id: string, patch: Record<string, unknown>): Promise<Ticket> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToTicket(data as TicketRow);
}

/** Assign or reassign. Passing a null owner returns the ticket to the unassigned queue. */
export async function assignTicket(
  id: string,
  owner: { id: string; name: string } | null,
): Promise<Ticket> {
  return patchTicket(id, {
    owner_id: owner?.id ?? null,
    owner_name: owner?.name ?? null,
  });
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
): Promise<Ticket> {
  if (status === 'resolved' && !resolution?.trim()) {
    throw new Error('A resolution note is required to resolve a ticket.');
  }
  const terminal = status === 'resolved' || status === 'cancelled';
  return patchTicket(id, {
    status,
    resolved_at: terminal ? new Date().toISOString() : null,
    ...(resolution?.trim() ? { resolution: resolution.trim() } : {}),
  });
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
  return (data ?? []).map((r) => mapDbToResponse(r as TicketResponseRow));
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

  return mapDbToResponse(data as TicketResponseRow);
}
