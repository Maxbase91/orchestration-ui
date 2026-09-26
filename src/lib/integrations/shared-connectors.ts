// The ports both sides read through: the connectors for the objects a server
// handler has to read the way the browser does, built for whichever client is
// given — the browser's /api/db one (registerDefaultConnectors) or the
// server's in-process one (api/_determination.ts).
//
// Submit decides a demand again on the server and refuses when the answer
// differs from what the requester reviewed (2026-09-26). That comparison is
// only fair when both decisions read the same data the same way, so the
// supplier, its contracts and its reusable risk assessments are read through
// these connectors on both sides — and a live connector for one of them
// (Release 2) is swapped here, once, for both. The server handlers read
// everything else with SQL still (ARCHITECTURE §4.4).
//
// Relative '.js' specifiers only: api/ imports this.
import type { Contract, RiskAssessment, Supplier } from '../../data/types.js';
import type { NeonCompatibleClient } from '../neon-compatible-client.js';
import type { SourceConnector } from './ports.js';
import { createSupplierConnector } from './own-store/supplier-connector.js';
import { createContractConnector } from './own-store/contract-connector.js';
import { createRiskAssessmentConnector } from './own-store/risk-assessment-connector.js';

export interface SharedConnectors {
  supplier: SourceConnector<string, Supplier>;
  contract: SourceConnector<string, Contract>;
  riskAssessment: SourceConnector<string, RiskAssessment>;
}

export function createSharedConnectors(client: NeonCompatibleClient): SharedConnectors {
  return {
    supplier: createSupplierConnector(client),
    contract: createContractConnector(client),
    riskAssessment: createRiskAssessmentConnector(client),
  };
}
