import type { Invoice } from '@/data/types';
import { getInvoice, listInvoices } from '@/lib/db/invoices';
import type { SourceConnector } from '../ports';
import { createOwnStoreConnector } from './factory';

/**
 * Invoice read connector backed by the platform's own store. A live AP / ERP
 * invoice source can replace this with no consumer change.
 */
export function createInvoiceConnector(
  sourceSystem = 'accounts-payable',
): SourceConnector<string, Invoice> {
  return createOwnStoreConnector<string, Invoice>({
    object: 'invoice',
    sourceSystem,
    freshnessTtlSeconds: 5 * 60,
    loadAll: listInvoices,
    loadOne: (id) => getInvoice(id),
    identity: (inv) => inv.id,
    searchText: (inv) => [inv.id, inv.supplierName].join(' '),
    matchFilter: (inv, field, value) => {
      switch (field) {
        case 'status':
          return inv.status === value;
        case 'matchStatus':
          return inv.matchStatus === value;
        case 'supplierId':
          return inv.supplierId === value;
        case 'poId':
          return inv.poId === value;
        default:
          return true;
      }
    },
  });
}
