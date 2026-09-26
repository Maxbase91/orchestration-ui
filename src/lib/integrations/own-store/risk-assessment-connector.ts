import type { RiskAssessment } from '../../../data/types.js';
import type { NeonCompatibleClient } from '../../neon-compatible-client.js';
import { getRiskAssessmentWith, listRiskAssessmentsWith } from '../../db/risk-assessments-core.js';
import type { SourceConnector } from '../ports.js';
import { createOwnStoreConnector } from './factory.js';

/**
 * Risk-assessment read connector backed by the platform's own store — the
 * third-party risk register the front-door risk checks read from — reading
 * with the client it is given, in the browser or on the server. A live risk
 * register can replace this with no consumer change. `reusable` and
 * `validAfter` support the reuse-matching path (assess once, reuse where still
 * valid — ../reusable-assessments.ts).
 */
export function createRiskAssessmentConnector(
  client: NeonCompatibleClient,
  sourceSystem = 'risk-register',
): SourceConnector<string, RiskAssessment> {
  return createOwnStoreConnector<string, RiskAssessment>({
    object: 'risk-assessment',
    sourceSystem,
    freshnessTtlSeconds: 60 * 60,
    loadAll: () => listRiskAssessmentsWith(client),
    loadOne: (id) => getRiskAssessmentWith(client, id),
    identity: (ra) => ra.id,
    searchText: (ra) => [ra.id, ra.title, ra.summary].join(' '),
    matchFilter: (ra, field, value) => {
      switch (field) {
        case 'status':
          return ra.status === value;
        case 'riskLevel':
          return ra.riskLevel === value;
        case 'category':
          return ra.category === value;
        case 'subjectType':
          return ra.subjectType === value;
        case 'supplierId':
          return ra.supplierId === value;
        case 'contractId':
          return ra.contractId === value;
        case 'reusable':
          return ra.reusable === Boolean(value);
        case 'validAfter':
          // Still valid after the given day (YYYY-MM-DD): the validity-window
          // query reuse matching needed before it could read through the port.
          // Strictly after, as the reuse rule has always read — an assessment
          // whose validity ends today is not offered for reuse.
          return (ra.validUntil ?? '').slice(0, 10) > String(value);
        default:
          return true;
      }
    },
  });
}
