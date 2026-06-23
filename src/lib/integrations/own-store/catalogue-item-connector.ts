import type { CatalogueItem } from '@/data/catalogue-items';
import { getCatalogueItem, listCatalogueItems } from '@/lib/db/catalogue-items';
import type { SourceConnector } from '../ports';
import { createOwnStoreConnector } from './factory';

/**
 * Catalogue-item read connector backed by the platform's own store — what the
 * front-door catalogue check matches against. A live catalogue source can
 * replace this with no consumer change.
 */
export function createCatalogueItemConnector(
  sourceSystem = 'catalogue',
): SourceConnector<string, CatalogueItem> {
  return createOwnStoreConnector<string, CatalogueItem>({
    object: 'catalogue-item',
    sourceSystem,
    freshnessTtlSeconds: 24 * 60 * 60,
    loadAll: listCatalogueItems,
    loadOne: (id) => getCatalogueItem(id),
    identity: (item) => item.id,
    searchText: (item) =>
      [item.id, item.name, item.description, item.supplierName].join(' '),
    matchFilter: (item, field, value) => {
      switch (field) {
        case 'catalogueId':
          return item.catalogueId === value;
        case 'supplierId':
          return item.supplierId === value;
        default:
          return true;
      }
    },
  });
}
