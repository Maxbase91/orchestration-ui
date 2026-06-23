import type { ProcurementRequest } from '@/data/types';
import { getRequest, listRequests } from '@/lib/db/requests';
import type { SourceConnector } from '../ports';
import { createOwnStoreConnector } from './factory';

/**
 * Purchase-request (demand) read connector backed by the platform's own store.
 * A live demand/requisition source can replace this with no consumer change.
 */
export function createRequestConnector(
  sourceSystem = 'demand-intake',
): SourceConnector<string, ProcurementRequest> {
  return createOwnStoreConnector<string, ProcurementRequest>({
    object: 'purchase-request',
    sourceSystem,
    freshnessTtlSeconds: 5 * 60,
    loadAll: listRequests,
    loadOne: (id) => getRequest(id),
    identity: (r) => r.id,
    searchText: (r) => [r.id, r.title, r.description, r.commodityCodeLabel].join(' '),
    matchFilter: (r, field, value) => {
      switch (field) {
        case 'status':
          return r.status === value;
        case 'priority':
          return r.priority === value;
        case 'category':
          return r.category === value;
        case 'buyingChannel':
          return r.buyingChannel === value;
        case 'supplierId':
          return r.supplierId === value;
        case 'ownerId':
          return r.ownerId === value;
        case 'isUrgent':
          return r.isUrgent === Boolean(value);
        case 'isOverdue':
          return r.isOverdue === Boolean(value);
        default:
          return true;
      }
    },
  });
}
