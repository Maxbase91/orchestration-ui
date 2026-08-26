// Shared ticket status/priority styling.
//
// Lives outside both consumers because the requester's ticket list and the agent
// inbox must agree on what "in progress" looks like — a user reading a colour on
// one screen and a different colour on the other has to re-learn the vocabulary.

import type { Ticket, TicketStatus } from '@/data/types';
import { slaState } from '@/lib/procurement/ticket-sla';

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-amber-100 text-amber-800',
  'in-progress': 'bg-blue-100 text-blue-800',
  'waiting-on-user': 'bg-purple-100 text-purple-800',
  resolved: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-orange-100 text-orange-700',
  high: 'bg-red-100 text-red-700',
};

/** Hyphenated slugs read as sentences: `waiting-on-user` → "Waiting on user". */
function humaniseStatus(status: string): string {
  return status.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export function TicketStatusBadge({ status }: { status: TicketStatus | string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
        STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600'
      }`}
    >
      {humaniseStatus(status)}
    </span>
  );
}

export function TicketPriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
        PRIORITY_STYLES[priority] ?? 'bg-gray-100 text-gray-600'
      }`}
    >
      {priority}
    </span>
  );
}

/**
 * SLA state. Silent when on-track, paused, or when no target was ever set —
 * a badge on every row would make the two states that need attention invisible.
 */
export function TicketSlaBadge({ ticket }: { ticket: Ticket }) {
  const state = slaState(ticket);
  if (state !== 'breached' && state !== 'at-risk') return null;

  const breached = state === 'breached';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
        breached ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
      }`}
    >
      {breached ? 'SLA breached' : 'Due soon'}
    </span>
  );
}
