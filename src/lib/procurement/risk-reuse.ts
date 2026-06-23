// Structured risk-register reuse model.
//
// Decides whether an existing assessment in the third-party risk register can be
// reused for a new demand, and if not, how far it diverges — reuse / amend /
// change / new. Principled rather than a bare flag: it compares supplier, scope
// (category), data class, inherent risk tier, and validity. Standardised and
// organisation-agnostic.

import type { RiskAssessment, RiskRating } from '@/data/types';
import type { DataSensitivity } from './materiality';
import { determineRiskOutcome, type RiskOutcome, riskTierRank } from './risk-segmentation';

const SENSITIVITY_RANK: Record<DataSensitivity, number> = {
  none: 0, low: 1, medium: 2, high: 3, critical: 4,
};
// reuse (best) → new (worst). The reuse decision is the worst across dimensions.
const OUTCOME_RANK: Record<RiskOutcome, number> = { reuse: 0, amend: 1, change: 2, new: 3 };

export interface ReuseDemand {
  supplierId?: string;
  category?: string;
  dataSensitivity?: DataSensitivity;
  inherentTier: RiskRating;
  /** ISO date; defaults handled by the caller. */
  now: string;
}

export interface ReuseEvaluation {
  decision: RiskOutcome | 'no-match';
  assessmentId?: string;
  reasons: string[];
}

function worst(a: RiskOutcome, b: RiskOutcome): RiskOutcome {
  return OUTCOME_RANK[a] >= OUTCOME_RANK[b] ? a : b;
}

/**
 * Evaluate one assessment against the demand. `no-match` when it can't apply at
 * all (different supplier, not reusable/completed). Otherwise the decision is the
 * worst outcome across the tier, scope and data-class dimensions, with `new` when
 * the assessment has lapsed.
 */
export function evaluateReuse(demand: ReuseDemand, a: RiskAssessment): ReuseEvaluation {
  const reasons: string[] = [];

  if (!a.reusable || a.status !== 'completed') {
    return { decision: 'no-match', assessmentId: a.id, reasons: ['Assessment is not reusable or not completed'] };
  }
  if (demand.supplierId && a.supplierId && demand.supplierId !== a.supplierId) {
    return { decision: 'no-match', assessmentId: a.id, reasons: ['Different supplier'] };
  }
  if (a.validUntil && a.validUntil < demand.now) {
    return { decision: 'new', assessmentId: a.id, reasons: ['Assessment has expired — a new assessment is required'] };
  }

  // Tier dimension (reuse/amend/change based on inherent vs assessed).
  const tier = determineRiskOutcome({
    inherentTier: demand.inherentTier,
    reusableAssessmentExists: true,
    highestAssessedTier: a.riskLevel,
  });
  let decision: RiskOutcome = tier.outcome;
  if (tier.outcome !== 'reuse') reasons.push(tier.reason);

  // Scope dimension: a different category means the assessed scope doesn't cover
  // this demand — at least an amendment.
  if (demand.category && a.category && demand.category !== a.category) {
    decision = worst(decision, 'amend');
    reasons.push(`Scope differs (assessed: ${a.category}, demand: ${demand.category})`);
  }

  // Data-class dimension: a higher data class than assessed needs reassessment.
  if (demand.dataSensitivity && a.assessedDataClass) {
    const gap = SENSITIVITY_RANK[demand.dataSensitivity] - SENSITIVITY_RANK[a.assessedDataClass];
    if (gap === 1) { decision = worst(decision, 'amend'); reasons.push('Data class one step above assessed'); }
    else if (gap > 1) { decision = worst(decision, 'change'); reasons.push('Data class materially above assessed'); }
  }

  if (decision === 'reuse') reasons.unshift('Supplier, scope, data class and risk tier all within the assessed band');
  return { decision, assessmentId: a.id, reasons };
}

/**
 * Pick the best reuse outcome across candidate assessments. Returns `new` when
 * there are no candidates. The chosen assessment is the one giving the most
 * favourable decision (reuse beats amend beats change).
 */
export function selectReuseOutcome(demand: ReuseDemand, assessments: RiskAssessment[]): ReuseEvaluation {
  const applicable = assessments
    .map((a) => evaluateReuse(demand, a))
    .filter((e): e is ReuseEvaluation & { decision: RiskOutcome } => e.decision !== 'no-match');
  if (applicable.length === 0) {
    return { decision: 'new', reasons: ['No reusable assessment covers this engagement'] };
  }
  return applicable.reduce((best, e) =>
    OUTCOME_RANK[e.decision] < OUTCOME_RANK[best.decision] ? e : best,
  );
}

export { riskTierRank };
