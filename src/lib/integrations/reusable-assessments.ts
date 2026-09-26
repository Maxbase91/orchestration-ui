// The risk assessments a demand can reuse, read through the risk-assessment
// port: reusable, completed, still valid after today, and of this supplier or
// this contract — most recently assessed first.
//
// This was a query of its own in src/lib/db/risk-assessments.ts, beside the
// port rather than through it, because the port could not ask for a validity
// window. It is the one rule now for the intake determination in the browser,
// submit's second decision on the server, and the risk stage's reuse — so the
// two decisions submit compares count the same assessments.
//
// Relative '.js' specifiers only: api/ imports this.
import type { RiskAssessment } from '../../data/types.js';
import type { SourceConnector } from './ports.js';

export interface ReusableAssessmentQuery {
  supplierId?: string;
  contractId?: string;
  /** Today, as YYYY-MM-DD — an input, so both sides judge validity on one day. */
  today: string;
}

export async function findReusableRiskAssessments(
  connector: SourceConnector<string, RiskAssessment>,
  { supplierId, contractId, today }: ReusableAssessmentQuery,
): Promise<RiskAssessment[]> {
  if (!supplierId && !contractId) return [];
  const records = await connector.list({ filters: { reusable: true, status: 'completed', validAfter: today } });
  // Supplier OR contract: the port's filters all have to hold, so the subject
  // is matched here.
  return records
    .map((record) => record.data)
    .filter((assessment) =>
      (Boolean(supplierId) && assessment.supplierId === supplierId)
      || (Boolean(contractId) && assessment.contractId === contractId));
}
