// Ticket SLA: due dates, breach and at-risk classification.
//
// Pure and side-effect free so the rules can be tested without a database, and
// so the queue can classify a row it already holds rather than asking the server.
//
// Targets come from the existing `sla_targets` table, keyed (stage, channel) —
// stage `ticket`, channel = the ticket's priority. Ticket targets are expressed
// in hours because "within 4 hours" is the promise the submission toast makes,
// and the table's original `days` column cannot express it.

import type { Ticket, TicketStatus } from '@/data/types';

/** Fallback when `sla_targets` has no row for a priority — never leave a ticket unbounded. */
export const DEFAULT_TICKET_SLA_HOURS = 8;

export interface TicketSlaTarget {
  channel: string;
  hours: number;
}

/** Hours allowed for a ticket at this priority. Falls back to the `default` channel. */
export function slaHoursForPriority(
  priority: string | undefined,
  targets: TicketSlaTarget[],
): number {
  const exact = targets.find((t) => t.channel === (priority ?? 'default'));
  if (exact) return exact.hours;
  const fallback = targets.find((t) => t.channel === 'default');
  return fallback?.hours ?? DEFAULT_TICKET_SLA_HOURS;
}

export function computeDueAt(
  from: Date,
  priority: string | undefined,
  targets: TicketSlaTarget[],
): string {
  const hours = slaHoursForPriority(priority, targets);
  return new Date(from.getTime() + hours * 60 * 60 * 1000).toISOString();
}

/**
 * Statuses where the clock does not run.
 *
 * `waiting-on-user` is the important one: while the requester is the blocker, an
 * agent-side breach would be a lie. The clock is stopped by clearing `due_at` on
 * entry and recomputing from "now" on exit, rather than accumulating paused
 * time — a ticket that comes back deserves a fresh response window, and an
 * accumulator would need a second column plus every transition to maintain it.
 */
const PAUSED_STATUSES: TicketStatus[] = ['waiting-on-user', 'resolved', 'cancelled'];

export function isSlaPaused(status: TicketStatus): boolean {
  return PAUSED_STATUSES.includes(status);
}

export type SlaState = 'on-track' | 'at-risk' | 'breached' | 'paused' | 'none';

/** Fraction of the window remaining at or below which a ticket reads as at-risk. */
export const AT_RISK_THRESHOLD_HOURS = 1;

/**
 * Classify a ticket against its due date. `none` means no target was ever set —
 * a ticket raised before SLAs existed, which must not be reported as on-track.
 */
export function slaState(ticket: Ticket, now: Date = new Date()): SlaState {
  if (isSlaPaused(ticket.status)) return 'paused';
  if (!ticket.dueAt) return 'none';

  const due = new Date(ticket.dueAt).getTime();
  const remainingMs = due - now.getTime();
  if (remainingMs <= 0) return 'breached';
  if (remainingMs <= AT_RISK_THRESHOLD_HOURS * 60 * 60 * 1000) return 'at-risk';
  return 'on-track';
}

export interface TicketSlaMetrics {
  open: number;
  breached: number;
  atRisk: number;
  /** Median hours from raise to resolve, over resolved tickets only. */
  medianHoursToResolve: number | null;
  /** Oldest open ticket in hours — the number that embarrasses a support team. */
  oldestOpenHours: number | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Headline support numbers for the queue. Cancelled tickets are excluded from
 * resolution timing — they were never resolved, and counting them would flatter
 * the median.
 */
export function ticketSlaMetrics(tickets: Ticket[], now: Date = new Date()): TicketSlaMetrics {
  const openTickets = tickets.filter((t) => t.status !== 'resolved' && t.status !== 'cancelled');

  const resolvedDurations = tickets
    .filter((t) => t.status === 'resolved' && t.resolvedAt)
    .map((t) => (new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime()) / HOUR_MS)
    .filter((h) => Number.isFinite(h) && h >= 0);

  const openAges = openTickets.map((t) => (now.getTime() - new Date(t.createdAt).getTime()) / HOUR_MS);

  return {
    open: openTickets.length,
    breached: tickets.filter((t) => slaState(t, now) === 'breached').length,
    atRisk: tickets.filter((t) => slaState(t, now) === 'at-risk').length,
    medianHoursToResolve: median(resolvedDurations),
    oldestOpenHours: openAges.length ? Math.max(...openAges) : null,
  };
}
