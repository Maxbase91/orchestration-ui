// Demand disposition — proceed / request-change / refer-back (RTE-06).
//
// The front door routes; it does not execute. After the determination, this
// decides whether the demand can proceed to its next step, needs a change
// before it can, or must be referred back to the requester. Standardised and
// organisation-agnostic — driven by completeness, policy and scope signals the
// determination already computes.

export type ReferralOutcome = 'proceed' | 'request-change' | 'refer-back';

export interface ReferralInput {
  /** Mandatory demand detail still missing (e.g. title or value). */
  missingMandatory: boolean;
  /** The demand falls outside supported/permissible scope. */
  outOfScope: boolean;
  /** Count of hard policy-check failures (0 when none / validator inactive). */
  failedPolicyChecks: number;
  /** A likely duplicate of an existing request was detected. */
  duplicateDetected: boolean;
}

export interface ReferralResult {
  outcome: ReferralOutcome;
  reason: string;
}

/**
 * Decide the demand disposition. Most-blocking wins: an incomplete or
 * out-of-scope demand is referred back to the requester; an otherwise-valid
 * demand with a fixable policy issue or a suspected duplicate needs a change
 * before it proceeds; everything else proceeds.
 */
export function determineReferral(input: ReferralInput): ReferralResult {
  if (input.missingMandatory) {
    return { outcome: 'refer-back', reason: 'Mandatory demand detail is missing — return to the requester to complete it' };
  }
  if (input.outOfScope) {
    return { outcome: 'refer-back', reason: 'Demand falls outside supported scope — refer back to the requester' };
  }
  if (input.failedPolicyChecks > 0) {
    return {
      outcome: 'request-change',
      reason: `${input.failedPolicyChecks} policy check${input.failedPolicyChecks > 1 ? 's' : ''} failed — request a change before proceeding`,
    };
  }
  if (input.duplicateDetected) {
    return { outcome: 'request-change', reason: 'A likely duplicate request exists — confirm or consolidate before proceeding' };
  }
  return { outcome: 'proceed', reason: 'No blocking issues — the demand can proceed to its next step' };
}
