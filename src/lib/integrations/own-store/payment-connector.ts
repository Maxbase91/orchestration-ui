import type { SupplierPayment } from '@/data/types';
import { getPayment, listPayments } from '@/lib/db/payments';
import type { SourceConnector } from '../ports';
import { createOwnStoreConnector } from './factory';

/**
 * Supplier payment / banking read connector backed by the platform's own store
 * (vendor-data foundation). A live AP / banking master can replace this with no
 * consumer change. Sensitive fields (IBAN/BIC) travel raw through the port —
 * masking is the consumer's responsibility, applied per role when surfaced.
 */
export function createPaymentConnector(
  sourceSystem = 'accounts-payable-master',
): SourceConnector<string, SupplierPayment> {
  return createOwnStoreConnector<string, SupplierPayment>({
    object: 'payment',
    sourceSystem,
    freshnessTtlSeconds: 24 * 60 * 60,
    loadAll: listPayments,
    loadOne: (id) => getPayment(id),
    identity: (p) => p.id,
    searchText: (p) => [p.id, p.supplierName, p.bankName].join(' '),
    matchFilter: (p, field, value) => {
      switch (field) {
        case 'supplierId':
          return p.supplierId === value;
        case 'verificationStatus':
          return p.verificationStatus === value;
        case 'currency':
          return p.currency === value;
        case 'preferredMethod':
          return p.preferredMethod === value;
        default:
          return true;
      }
    },
  });
}
