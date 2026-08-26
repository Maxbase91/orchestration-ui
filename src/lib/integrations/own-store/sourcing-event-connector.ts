import type { SourceConnector } from '../ports';
import { getSourcingEvent, listSourcingEvents, type SourcingEvent } from '@/lib/db/sourcing-events';
import { createOwnStoreConnector } from './factory';

/**
 * Sourcing-event read connector backed by the platform's own store — the system
 * of record for RFx events in this release. A live sourcing suite can replace
 * this with no consumer change.
 *
 * Moderate TTL: an event's own fields (title, dates, criteria) change rarely
 * once published, unlike a support queue. What moves is the response set, and
 * that is read through the responses module rather than this port.
 *
 * `requestId` is filterable here because the link is a column on the event. The
 * reverse direction — "which suppliers were invited" — is a join into
 * sourcing_responses, so it deliberately is not a field test; use
 * listResponsesForEvent() instead.
 */
export function createSourcingEventConnector(
  sourceSystem = 'sourcing',
): SourceConnector<string, SourcingEvent> {
  return createOwnStoreConnector<string, SourcingEvent>({
    object: 'sourcing-event',
    sourceSystem,
    freshnessTtlSeconds: 300,
    loadAll: listSourcingEvents,
    loadOne: (id) => getSourcingEvent(id),
    identity: (e) => e.id,
    searchText: (e) => [e.id, e.title, e.category, e.description].join(' '),
    matchFilter: (e, field, value) => {
      switch (field) {
        case 'status':
          return e.status === value;
        case 'type':
          return e.type === value;
        case 'category':
          return e.category === value;
        case 'ownerId':
          return e.ownerId === value;
        case 'requestId':
          return e.requestId === value;
        case 'awardedSupplierId':
          return e.awardedSupplierId === value;
        default:
          return true;
      }
    },
  });
}
