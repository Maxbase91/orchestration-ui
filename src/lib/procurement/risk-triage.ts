// Whether the full risk-triage questionnaire needs to run for a demand.
//
// Moved out of `step-compliance.tsx`, a 1,200-line component that exported it
// alongside the component itself — which breaks Fast Refresh for that module
// and hid a decisioning rule inside a screen. Decisioning belongs in
// `lib/procurement` (see CLAUDE.md conventions), where it is reachable by tests
// and by anything else that needs the same answer.
//
// Behaviour is unchanged: this is a move, not a retune.

/**
 * Decide whether the full risk-triage questionnaire needs to render.
 *
 * Triage is REQUIRED when at least one of these is true:
 *   - supplier has no valid SRA on file (not-assessed / expired / unknown)
 *   - no reusable risk assessment already covers this supplier AND
 *     data sensitivity is high/critical, OR the supplier is new, OR the
 *     supplier's own risk rating is high/critical.
 *
 * When triage is NOT required we render a short confirmation card
 * instead, citing which reusable SRA covers the case.
 */
export function isTriageRequired(params: {
  supplierSraStatus?: string;
  supplierRiskRating?: string;
  supplierRegistered: boolean;
  matchingReusableSraCount: number;
  inferredDataSensitivity: 'none' | 'low' | 'medium' | 'high' | 'critical';
}): { required: boolean; reason: string } {
  const {
    supplierSraStatus,
    supplierRiskRating,
    supplierRegistered,
    matchingReusableSraCount,
    inferredDataSensitivity,
  } = params;

  // No supplier selected yet → always require triage; we don't know who
  // we'll be engaging.
  if (!supplierRegistered) {
    return { required: true, reason: 'new or unselected supplier' };
  }

  // Missing / expired SRA → triage must run regardless of sensitivity.
  if (
    supplierSraStatus === 'not-assessed' ||
    supplierSraStatus === 'expired' ||
    !supplierSraStatus
  ) {
    return { required: true, reason: `supplier SRA status is ${supplierSraStatus ?? 'unknown'}` };
  }

  // High-risk supplier on record — always triage.
  if (supplierRiskRating === 'high' || supplierRiskRating === 'critical') {
    return { required: true, reason: `supplier risk rating is ${supplierRiskRating}` };
  }

  // Reusable SRA covers it AND SOW doesn't suggest sensitive data →
  // triage can be skipped.
  if (matchingReusableSraCount > 0) {
    if (inferredDataSensitivity === 'high' || inferredDataSensitivity === 'critical') {
      return { required: true, reason: `data sensitivity is ${inferredDataSensitivity}` };
    }
    return {
      required: false,
      reason: `${matchingReusableSraCount} reusable risk assessment${matchingReusableSraCount === 1 ? '' : 's'} cover${matchingReusableSraCount === 1 ? 's' : ''} this supplier`,
    };
  }

  // No reusable SRA + sensitive SOW → triage.
  if (inferredDataSensitivity === 'high' || inferredDataSensitivity === 'critical') {
    return { required: true, reason: `data sensitivity is ${inferredDataSensitivity}` };
  }

  // Supplier has valid SRA, low risk, low data sensitivity, no reusable
  // SRA but also no red flags — still run triage as the safer default
  // unless we can point to a reusable SRA above.
  return { required: true, reason: 'no reusable SRA on file' };
}
