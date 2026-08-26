// Support-ticket data access. The platform's own store is the system of record —
// there is no upstream service desk in this release.
//
// Every ticket write in the app funnels through here. Before this module the
// three intake paths each rolled their own: the Contact Support form and
// api/chat.ts both inserted directly (duplicating a racy ID generator), and the
// assistant's mock handover appended to an in-memory array that was lost on
// refresh — while telling the user to go find the ticket in Help → Support.

import { supabase } from '@/lib/supabase-client';
import type { Ticket } from '@/data/types';

const TABLE = 'tickets';

/** Raw shape of a ticket row. Kept local until the mapper layer covers tickets. */
interface TicketRow {
  id: string;
  summary: string;
  context: string;
  status: string;
  created_at: string;
  created_by: string;
  category: string | null;
  priority: string | null;
}

function mapDbToTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    summary: row.summary,
    context: row.context,
    status: row.status as Ticket['status'],
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

/**
 * Next sequential ticket ID (TKT-0001, TKT-0002, …).
 *
 * Reads the highest existing number rather than counting rows, so a deleted
 * ticket can't cause an ID to be reused. Still racy under concurrent submission
 * — two callers can read the same maximum and the second insert then fails on
 * the primary key. Accepted here because it is no worse than the two call sites
 * this replaces; a Postgres sequence removes the race properly and is tracked
 * as part of the inbox work.
 */
async function nextTicketId(): Promise<string> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  const lastNum = data?.id ? Number.parseInt(String(data.id).replace('TKT-', ''), 10) : 0;
  const next = Number.isFinite(lastNum) ? lastNum + 1 : 1;
  return `TKT-${String(next).padStart(4, '0')}`;
}

export interface CreateTicketInput {
  summary: string;
  context: string;
  createdBy: string;
  category?: string;
  priority?: string;
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
      ...(input.category ? { category: input.category } : {}),
      ...(input.priority ? { priority: input.priority } : {}),
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToTicket(data as TicketRow);
}

/**
 * Tickets visible to the caller. `allTickets` is the agent view — pass it only
 * for roles entitled to the queue; every other caller sees just their own.
 */
export async function listTickets(
  userName: string,
  opts: { allTickets?: boolean; limit?: number } = {},
): Promise<Ticket[]> {
  let query = supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 20);

  if (!opts.allTickets) query = query.eq('created_by', userName);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => mapDbToTicket(r as TicketRow));
}

export async function getTicket(id: string): Promise<Ticket | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapDbToTicket(data as TicketRow) : null;
}
