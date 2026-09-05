// The ticket write that both intake paths share.
//
// It takes its client as a parameter because there are two: the browser holds
// the /api/db singleton, the serverless handlers hold the privileged in-process
// one. src/lib/db/tickets.ts imports '@/lib/db-client', and that alias is
// resolved by tsconfig.api.json for tsc but NOT by Vercel at runtime — which is
// why api/chat.ts grew its own copy of this write instead of importing it.
//
// The copy had already drifted: it set no due_at, so every assistant-raised
// ticket was created with no SLA while form-raised ones had one. Sharing the
// implementation is what closes that, and is why this module uses relative
// '.js' specifiers only, per the convention in src/lib/db/mappers.ts.
import type { NeonCompatibleClient, DbRow } from '../neon-compatible-client.js';
import { computeDueAt, type TicketSlaTarget } from '../procurement/ticket-sla.js';

const TABLE = 'tickets';

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
 * Next ticket id from the Postgres sequence.
 *
 * Falls back to a timestamp-suffixed id if the RPC is unavailable — an
 * environment provisioned before the sequence existed. A collision-free but
 * non-sequential id beats failing the user's submission outright.
 */
export async function nextTicketIdWith(client: NeonCompatibleClient): Promise<string> {
  const { data, error } = await client.rpc('next_ticket_id');
  if (error || !data) return `TKT-${Date.now().toString().slice(-8)}`;
  return String(data);
}

/**
 * SLA targets for tickets, from the shared sla_targets table (stage 'ticket',
 * channel = priority). Read at create time so a target changed in admin applies
 * to new tickets without a deploy.
 */
export async function loadTicketSlaTargetsWith(client: NeonCompatibleClient): Promise<TicketSlaTarget[]> {
  const { data, error } = await client
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

/** Create a ticket with a sequence id and an SLA due date. Returns the raw row. */
export async function createTicketWith(client: NeonCompatibleClient, input: CreateTicketInput): Promise<DbRow> {
  const id = await nextTicketIdWith(client);
  const targets = await loadTicketSlaTargetsWith(client);
  const dueAt = computeDueAt(new Date(), input.priority, targets);

  const { data, error } = await client
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
  return data as DbRow;
}
