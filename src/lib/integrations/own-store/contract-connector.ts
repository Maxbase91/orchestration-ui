import type { Contract } from '../../../data/types.js';
import type { NeonCompatibleClient } from '../../neon-compatible-client.js';
import { getContractWith, listContractsWith } from '../../db/contracts-core.js';
import type { SourceConnector } from '../ports.js';
import { createOwnStoreConnector } from './factory.js';

/**
 * Contract read connector backed by the platform's own store, reading with the
 * client it is given, in the browser or on the server. Exposes the fields the
 * front-door contract checks rely on (status, category, supplier, utilisation)
 * and a transactability view derived from status + utilisation. A live
 * contract-management connector can replace this implementation without
 * changing the consuming checks.
 */
export function createContractConnector(
  client: NeonCompatibleClient,
  sourceSystem = 'contract-management',
): SourceConnector<string, Contract> {
  return createOwnStoreConnector<string, Contract>({
    object: 'contract',
    sourceSystem,
    freshnessTtlSeconds: 24 * 60 * 60,
    loadAll: () => listContractsWith(client),
    loadOne: (id) => getContractWith(client, id),
    identity: (c) => c.id,
    searchText: (c) => [c.id, c.title, c.supplierName, c.category].join(' '),
    matchFilter: (c, field, value) => {
      switch (field) {
        case 'status':
          return c.status === value;
        case 'category':
          return c.category === value;
        case 'supplierId':
          return c.supplierId === value;
        case 'transactable':
          // A contract is transactable when active and not fully utilised.
          return (c.status === 'active' && c.utilisationPercentage < 100) === Boolean(value);
        default:
          return true;
      }
    },
  });
}
