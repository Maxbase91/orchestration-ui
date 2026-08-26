// Sourcing evaluation and award rules.
//
// Pure and side-effect free so the rules can be tested without a database and
// reused by both the scoring matrix and the award action. The write-back itself
// lives in the data layer; what belongs here is the question of *whether* an
// award is legitimate and *what* the request inherits from it.

import type { SourcingCriterion } from '@/lib/db/sourcing-events';

/** Weights must total this for a weighted score to be meaningful. */
export const REQUIRED_CRITERIA_WEIGHT_TOTAL = 100;

/**
 * Weighted average on the 1–5 scale, normalised by the weight sum so totals stay
 * comparable even when the configured weights do not add to exactly 100.
 * Unscored criteria count as 0, penalising incomplete evaluations.
 */
export function calcWeightedTotal(
  scores: Record<string, number>,
  criteria: SourcingCriterion[],
): number {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const c of criteria) {
    weightedSum += (scores[c.id] ?? 0) * c.weight;
    totalWeight += c.weight;
  }
  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0;
}

export function criteriaWeightTotal(criteria: SourcingCriterion[]): number {
  return criteria.reduce((sum, c) => sum + c.weight, 0);
}

export function areCriteriaWeightsValid(criteria: SourcingCriterion[]): boolean {
  return criteriaWeightTotal(criteria) === REQUIRED_CRITERIA_WEIGHT_TOTAL;
}

/** The subset of a response the award rules need — keeps this module DB-free. */
export interface AwardCandidate {
  id: string;
  supplierId: string;
  supplierName: string;
  status: string;
  shortlisted: boolean;
  weightedTotal?: number;
  price?: number;
}

/**
 * Rank candidates best-first.
 *
 * Only submitted, shortlisted responses can rank — an eliminated or silent
 * supplier must never surface as a recommendation. Ties break on the lower
 * price, then on name so the order is stable rather than dependent on row order.
 */
export function rankResponses(candidates: AwardCandidate[]): AwardCandidate[] {
  return candidates
    .filter((c) => c.status === 'responded' && c.shortlisted)
    .sort((a, b) => {
      const byScore = (b.weightedTotal ?? 0) - (a.weightedTotal ?? 0);
      if (byScore !== 0) return byScore;
      const byPrice = (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY);
      if (byPrice !== 0) return byPrice;
      return a.supplierName.localeCompare(b.supplierName);
    });
}

export type AwardBlocker =
  | 'event-not-live'
  | 'already-awarded'
  | 'no-eligible-responses'
  | 'response-not-eligible';

export interface AwardCheck {
  allowed: boolean;
  blocker?: AwardBlocker;
  reason?: string;
}

/** Event statuses from which an award is legitimate. */
const AWARDABLE_EVENT_STATUSES = ['published', 'in-evaluation', 'award-pending'];

/**
 * Whether a specific response can be awarded on a specific event.
 *
 * Deliberately checks the event *and* the response: awarding from a completed
 * event, or awarding a supplier who never submitted, are different mistakes and
 * the caller should be able to tell the user which one they made.
 */
export function canAward(
  event: { status: string; awardedSupplierId?: string },
  candidates: AwardCandidate[],
  responseId: string,
): AwardCheck {
  if (!AWARDABLE_EVENT_STATUSES.includes(event.status)) {
    return { allowed: false, blocker: 'event-not-live', reason: `Event is ${event.status}` };
  }
  if (event.awardedSupplierId) {
    return { allowed: false, blocker: 'already-awarded', reason: 'This event has already been awarded' };
  }
  const eligible = rankResponses(candidates);
  if (eligible.length === 0) {
    return {
      allowed: false,
      blocker: 'no-eligible-responses',
      reason: 'No shortlisted supplier has submitted a response',
    };
  }
  if (!eligible.some((c) => c.id === responseId)) {
    return {
      allowed: false,
      blocker: 'response-not-eligible',
      reason: 'That response is not submitted, or has been eliminated',
    };
  }
  return { allowed: true };
}

/**
 * What the originating request inherits from the award.
 *
 * Kept separate from the write so the write-back stays idempotent: re-applying
 * the same award produces the same patch, which is what makes the recovery
 * action safe after a partial failure.
 */
export function awardWriteBack(winner: AwardCandidate): { supplierId: string; supplierName: string } {
  return { supplierId: winner.supplierId, supplierName: winner.supplierName };
}
