// The risk stage's side effect: make sure the request has a risk assessment to
// act on, reusing an existing one where the register already covers the subject.
//
// Before this, "Risk assessment required" was a flag the intake wizard computed,
// showed in an amber banner promising "it appears as a step in the workflow",
// and then discarded. Nothing ever created a risk_assessments record — the only
// way one existed was an admin typing it into the database browser.

import {
  createRiskAssessment,
  findMatchingRiskAssessments,
  updateRiskAssessment,
} from '@/lib/db/risk-assessments';
import type { ProcurementRequest, RiskAssessment, RiskRating } from '@/data/types';

/** How long a newly raised assessment stays valid, in days. */
const VALIDITY_DAYS = 365;

/** The intake risk tier maps straight onto the register's rating scale. */
function ratingFromTier(tier: string | undefined): RiskRating {
  if (tier === 'critical' || tier === 'high' || tier === 'medium' || tier === 'low') {
    return tier as RiskRating;
  }
  return 'medium';
}

export interface RiskStageOutcome {
  /** The assessment the stage is about. */
  assessment: RiskAssessment;
  /** True when an existing reusable assessment covered it, so no new work is needed. */
  reused: boolean;
}

/**
 * Ensure a risk assessment exists for a request entering the risk stage.
 *
 * Reuse wins where it applies: `findMatchingRiskAssessments` already filters to
 * `reusable && completed && valid_until > today` for the same supplier or
 * contract, and re-running a live assessment is duplicated work the register
 * exists to prevent. A reused assessment gains the request in its
 * `linkedRequestIds` so the reuse is auditable rather than invisible.
 *
 * Returns null when there is no subject to assess — an assessment must attach to
 * a supplier or a contract, and a request naming neither has nothing to assess
 * yet. The stage still gates; it just has no record to show, which is honest.
 */
export async function ensureRiskAssessment(
  request: Pick<
    ProcurementRequest,
    'id' | 'title' | 'supplierId' | 'contractId' | 'category' | 'inherentRiskTier'
  >,
  actor: { id: string; name: string },
): Promise<RiskStageOutcome | null> {
  if (!request.supplierId && !request.contractId) return null;

  const matches = await findMatchingRiskAssessments({
    ...(request.supplierId ? { supplierId: request.supplierId } : {}),
    ...(request.contractId ? { contractId: request.contractId } : {}),
  });

  if (matches.length > 0) {
    const reused = matches[0]!;
    if (!reused.linkedRequestIds.includes(request.id)) {
      await updateRiskAssessment(reused.id, {
        linkedRequestIds: [...reused.linkedRequestIds, request.id],
      });
    }
    return { assessment: reused, reused: true };
  }

  const now = new Date();
  const validUntil = new Date(now.getTime());
  validUntil.setDate(validUntil.getDate() + VALIDITY_DAYS);

  const created = await createRiskAssessment({
    id: `RA-${request.id}-${now.getTime().toString().slice(-6)}`,
    title: `Third-party risk — ${request.title}`,
    subjectType: request.contractId ? 'contract' : 'supplier',
    ...(request.supplierId ? { supplierId: request.supplierId } : {}),
    ...(request.contractId ? { contractId: request.contractId } : {}),
    category: 'operational',
    riskLevel: ratingFromTier(request.inherentRiskTier),
    score: 0,
    // Draft, not completed: the engine raising the record is not the same as
    // somebody having done the assessment. The stage stays gated until a human
    // completes it, which is the whole point of it being a stage.
    status: 'draft',
    assessorId: actor.id,
    assessorName: actor.name,
    assessedAt: now.toISOString(),
    validUntil: validUntil.toISOString().slice(0, 10),
    summary: `Raised automatically when ${request.id} entered the risk stage; inherent tier ${request.inherentRiskTier ?? 'unknown'}.`,
    mitigations: [],
    reusable: true,
    linkedRequestIds: [request.id],
  });

  return { assessment: created, reused: false };
}

/** Terminal statuses — the stage can be completed once the assessment reaches one. */
const TERMINAL_ASSESSMENT_STATUSES = new Set(['completed', 'expired']);

/**
 * Can the risk stage be left?
 *
 * A draft or in-review assessment means the work is not finished, so completing
 * the stage would assert a decision nobody made.
 */
export function canCompleteRiskStage(assessment: RiskAssessment | null | undefined): boolean {
  return Boolean(assessment && TERMINAL_ASSESSMENT_STATUSES.has(assessment.status));
}
