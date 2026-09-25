// Support-ticket response targets: `sla_targets` rows with stage 'ticket',
// one per priority (channel = high | medium | low | default), in hours.
//
// Read at ticket creation by tickets-core.ts. This is everything that table
// still does: its stage rows were deleted when the workflow templates became
// the one home of stage SLAs.
import { db } from '@/lib/db-client';

export interface TicketSla {
  priority: string;
  hours: number;
}

/** The priorities a ticket can have, in the order the page lists them. */
export const TICKET_PRIORITIES = ['high', 'medium', 'low', 'default'] as const;

export async function listTicketSlas(): Promise<TicketSla[]> {
  const { data, error } = await db.from('sla_targets').select('channel, hours, days').eq('stage', 'ticket');
  if (error) throw error;
  return (data ?? []).map((r) => {
    const row = r as { channel: string; hours: number | null; days: number | null };
    return { priority: row.channel, hours: row.hours ?? (row.days ?? 1) * 24 };
  });
}

export async function saveTicketSla(sla: TicketSla): Promise<void> {
  // `days` is NOT NULL and predates `hours`; kept consistent so the column
  // never contradicts the figure that is actually read.
  const { error } = await db.from('sla_targets').upsert({
    stage: 'ticket', channel: sla.priority, hours: sla.hours, days: Math.max(1, Math.ceil(sla.hours / 24)),
  }, { onConflict: 'stage,channel' });
  if (error) throw error;
}
