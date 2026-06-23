import type { RiskAssessment } from '@/data/types';
import { getRiskAssessment, listRiskAssessments } from '@/lib/db/risk-assessments';
import type { SourceConnector } from '../ports';
import { createOwnStoreConnector } from './factory';

/**
 * Risk-assessment read connector backed by the platform's own store — the
 * third-party risk register the front-door risk checks read from. A live risk
 * register can replace this with no consumer change. `reusable` supports the
 * reuse-matching path (assess once, reuse where still valid).
 */
export function createRiskAssessmentConnector(
  sourceSystem = 'risk-register',
): SourceConnector<string, RiskAssessment> {
  return createOwnStoreConnector<string, RiskAssessment>({
    object: 'risk-assessment',
    sourceSystem,
    freshnessTtlSeconds: 60 * 60,
    loadAll: listRiskAssessments,
    loadOne: (id) => getRiskAssessment(id),
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
        default:
          return true;
      }
    },
  });
}
