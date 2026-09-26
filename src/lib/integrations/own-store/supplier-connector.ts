import type { Supplier } from '../../../data/types.js';
import type { NeonCompatibleClient } from '../../neon-compatible-client.js';
import { getSupplierWith, listSuppliersWith } from '../../db/suppliers-core.js';
import type { SourceConnector } from '../ports.js';
import { createOwnStoreConnector } from './factory.js';

/**
 * Supplier read connector backed by the platform's own store, reading with the
 * client it is given — the browser's /api/db one, or the server's in-process
 * one — so both sides read suppliers the same way. `sourceSystem` is the
 * deployment-configured identifier of the upstream supplier master this store
 * stands in for; a live connector can replace this with no consumer change.
 */
export function createSupplierConnector(
  client: NeonCompatibleClient,
  sourceSystem = 'supplier-master',
): SourceConnector<string, Supplier> {
  return createOwnStoreConnector<string, Supplier>({
    object: 'supplier',
    sourceSystem,
    freshnessTtlSeconds: 24 * 60 * 60,
    loadAll: () => listSuppliersWith(client),
    loadOne: (id) => getSupplierWith(client, id),
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
