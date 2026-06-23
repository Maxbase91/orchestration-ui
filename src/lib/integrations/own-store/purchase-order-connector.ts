import type { PurchaseOrder } from '@/data/types';
import { getPurchaseOrder, listPurchaseOrders } from '@/lib/db/purchase-orders';
import type { SourceConnector } from '../ports';
import { createOwnStoreConnector } from './factory';

/**
 * Purchase-order read connector backed by the platform's own store. A live ERP
 * purchase-order source can replace this with no consumer change.
 */
export function createPurchaseOrderConnector(
  sourceSystem = 'purchase-orders',
): SourceConnector<string, PurchaseOrder> {
  return createOwnStoreConnector<string, PurchaseOrder>({
    object: 'purchase-order',
    sourceSystem,
    freshnessTtlSeconds: 5 * 60,
    loadAll: listPurchaseOrders,
    loadOne: (id) => getPurchaseOrder(id),
    identity: (po) => po.id,
    searchText: (po) => [po.id, po.supplierName].join(' '),
    matchFilter: (po, field, value) => {
      switch (field) {
        case 'status':
          return po.status === value;
        case 'supplierId':
          return po.supplierId === value;
        case 'contractId':
          return po.contractId === value;
        case 'requestId':
          return po.requestId === value;
        default:
          return true;
      }
    },
  });
}
