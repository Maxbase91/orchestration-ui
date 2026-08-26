import type { Ticket } from '@/data/types';
import { getTicket, listTickets } from '@/lib/db/tickets';
import type { SourceConnector } from '../ports';
import { createOwnStoreConnector } from './factory';

/**
 * Support-ticket read connector backed by the platform's own store — the system
 * of record for tickets in this release. A live service desk (ServiceNow and
 * similar) can replace this with no consumer change.
 *
 * Reads are unscoped by design: the connector is the agent-side view, so it
 * loads every ticket. Requester-scoped reads deliberately bypass it and call
 * listTickets() with the caller's name, because entitlement depends on who is
 * asking and the port has no notion of a current user.
 *
 * Short TTL relative to the other connectors: a support queue is worked
 * continuously by several people at once, so a stale list is worse here than
 * for reference data like contracts or the catalogue.
 */
export function createTicketConnector(
  sourceSystem = 'support-desk',
): SourceConnector<string, Ticket> {
  return createOwnStoreConnector<string, Ticket>({
    object: 'support-ticket',
    sourceSystem,
    freshnessTtlSeconds: 60,
    loadAll: () => listTickets('', { allTickets: true, limit: 500 }),
    loadOne: (id) => getTicket(id),
    identity: (t) => t.id,
    searchText: (t) => [t.id, t.summary, t.context, t.createdBy, t.ownerName ?? ''].join(' '),
    matchFilter: (t, field, value) => {
      switch (field) {
        case 'status':
          return t.status === value;
        case 'priority':
          return t.priority === value;
        case 'category':
          return t.category === value;
        case 'ownerId':
          // `unassigned` is the inbox's default triage view, so it needs to be
          // expressible as a filter value rather than a separate query.
          return value === 'unassigned' ? !t.ownerId : t.ownerId === value;
        case 'createdBy':
          return t.createdBy === value;
        // References live in ticket_links, so filtering by linked object is a
        // join rather than a field test — use listTicketsForObject() instead.
        default:
          return true;
      }
    },
  });
}
