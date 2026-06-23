import type { Contract } from '@/data/types';
import { getContract, listContracts } from '@/lib/db/contracts';
import type { SourceConnector } from '../ports';
import { createOwnStoreConnector } from './factory';

/**
 * Contract read connector backed by the platform's own store. Exposes the
 * fields the front-door contract checks rely on (status, category, supplier,
 * utilisation) and a transactability view derived from status + utilisation.
 * A live contract-management connector can replace this implementation without
 * changing the consuming checks.
 */
export function createContractConnector(
  sourceSystem = 'contract-management',
): SourceConnector<string, Contract> {
  return createOwnStoreConnector<string, Contract>({
    object: 'contract',
    sourceSystem,
    freshnessTtlSeconds: 24 * 60 * 60,
    loadAll: listContracts,
    loadOne: (id) => getContract(id),
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
