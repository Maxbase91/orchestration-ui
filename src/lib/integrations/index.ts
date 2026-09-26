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
export { createSharedConnectors, type SharedConnectors } from './shared-connectors';
export { findReusableRiskAssessments, type ReusableAssessmentQuery } from './reusable-assessments';
export { createCatalogueItemConnector } from './own-store/catalogue-item-connector';
export { createPaymentConnector } from './own-store/payment-connector';
export { createTicketConnector } from './own-store/ticket-connector';
export { createSourcingEventConnector } from './own-store/sourcing-event-connector';
export { useSourceObject, useSourceList, useSourceData, useSourceDatum } from './hooks';

import { db } from '@/lib/db-client';
import { registerConnector } from './registry';
import { createSharedConnectors } from './shared-connectors';
import { createRequestConnector } from './own-store/request-connector';
import { createPurchaseOrderConnector } from './own-store/purchase-order-connector';
import { createInvoiceConnector } from './own-store/invoice-connector';
import { createCatalogueItemConnector } from './own-store/catalogue-item-connector';
import { createPaymentConnector } from './own-store/payment-connector';
import { createTicketConnector } from './own-store/ticket-connector';
import { createSourcingEventConnector } from './own-store/sourcing-event-connector';

let registered = false;

/**
 * Register the default own-store connectors. Idempotent — safe to call from app
 * bootstrap. Replace or extend by calling `registerConnector` with a live
 * implementation for any object type.
 */
export function registerDefaultConnectors(): void {
  if (registered) return;
  // The three the server reads too come from the one factory both sides call,
  // so a live connector for any of them is swapped once, for both.
  const shared = createSharedConnectors(db);
  registerConnector(shared.supplier);
  registerConnector(shared.contract);
  registerConnector(createRequestConnector());
  registerConnector(createPurchaseOrderConnector());
  registerConnector(createInvoiceConnector());
  registerConnector(shared.riskAssessment);
  registerConnector(createCatalogueItemConnector());
  registerConnector(createPaymentConnector());
  registerConnector(createTicketConnector());
  registerConnector(createSourcingEventConnector());
  registered = true;
}
