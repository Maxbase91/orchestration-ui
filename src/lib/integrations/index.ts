// Source-connector layer — public entry point.
//
// Import from here to read upstream business objects through the standardised
// ports. Call `registerDefaultConnectors()` once at app start to wire the
// own-store implementations (the system of record for this release).

export type {
  SourceObject,
  SourceMode,
  SourceMeta,
  SourceRecord,
  SourceQuery,
  SourceConnector,
} from './ports';
export { sourceMeta, wrap } from './ports';
export {
  registerConnector,
  getConnector,
  requireConnector,
  registeredObjects,
  resetRegistry,
} from './registry';
export { createOwnStoreConnector } from './own-store/factory';
export type { OwnStoreConfig } from './own-store/factory';
export { createSupplierConnector } from './own-store/supplier-connector';
export { createContractConnector } from './own-store/contract-connector';
export { createRequestConnector } from './own-store/request-connector';
export { createPurchaseOrderConnector } from './own-store/purchase-order-connector';
export { createInvoiceConnector } from './own-store/invoice-connector';
export { createRiskAssessmentConnector } from './own-store/risk-assessment-connector';
export { createCatalogueItemConnector } from './own-store/catalogue-item-connector';
export { useSourceObject, useSourceList, useSourceData, useSourceDatum } from './hooks';

import { registerConnector } from './registry';
import { createSupplierConnector } from './own-store/supplier-connector';
import { createContractConnector } from './own-store/contract-connector';
import { createRequestConnector } from './own-store/request-connector';
import { createPurchaseOrderConnector } from './own-store/purchase-order-connector';
import { createInvoiceConnector } from './own-store/invoice-connector';
import { createRiskAssessmentConnector } from './own-store/risk-assessment-connector';
import { createCatalogueItemConnector } from './own-store/catalogue-item-connector';

let registered = false;

/**
 * Register the default own-store connectors. Idempotent — safe to call from app
 * bootstrap. Replace or extend by calling `registerConnector` with a live
 * implementation for any object type.
 */
export function registerDefaultConnectors(): void {
  if (registered) return;
  registerConnector(createSupplierConnector());
  registerConnector(createContractConnector());
  registerConnector(createRequestConnector());
  registerConnector(createPurchaseOrderConnector());
  registerConnector(createInvoiceConnector());
  registerConnector(createRiskAssessmentConnector());
  registerConnector(createCatalogueItemConnector());
  registered = true;
}
