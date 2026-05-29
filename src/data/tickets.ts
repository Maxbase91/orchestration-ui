import type { Ticket } from './types';

// In-memory ticket store. Phase 2 will migrate this to Supabase.
const tickets: Ticket[] = [];

export function getTickets(): Ticket[] {
  return tickets;
}

export function appendTicket(summary: string, context: string, createdBy: string): Ticket {
  const ticket: Ticket = {
    id: `TKT-${String(tickets.length + 1).padStart(4, '0')}`,
    summary,
    context,
    status: 'open',
    createdAt: new Date().toISOString(),
    createdBy,
  };
  tickets.push(ticket);
  return ticket;
}
