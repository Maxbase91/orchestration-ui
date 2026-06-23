import type { Supplier } from '@/data/types';
import { getSupplier, listSuppliers } from '@/lib/db/suppliers';
import type { SourceConnector } from '../ports';
import { createOwnStoreConnector } from './factory';

/**
 * Supplier read connector backed by the platform's own store. `sourceSystem`
 * is the deployment-configured identifier of the upstream supplier master this
 * store stands in for; a live connector can replace this with no consumer change.
 */
export function createSupplierConnector(
  sourceSystem = 'supplier-master',
): SourceConnector<string, Supplier> {
  return createOwnStoreConnector<string, Supplier>({
    object: 'supplier',
    sourceSystem,
    freshnessTtlSeconds: 24 * 60 * 60,
    loadAll: listSuppliers,
    loadOne: (id) => getSupplier(id),
    identity: (s) => s.id,
    searchText: (s) => [s.id, s.name, s.country, s.categories.join(' ')].join(' '),
    matchFilter: (s, field, value) => {
      switch (field) {
        case 'riskRating':
          return s.riskRating === value;
        case 'screeningStatus':
          return s.screeningStatus === value;
        case 'sraStatus':
          return s.sraStatus === value;
        case 'tier':
          return s.tier === Number(value);
        case 'category':
          return s.categories.includes(String(value));
        default:
          return true;
      }
    },
  });
}
