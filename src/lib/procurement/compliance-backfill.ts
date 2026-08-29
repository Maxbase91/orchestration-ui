// Backfill for the six front-door determination fields on a request record
// (inherentRiskTier, materialityTier, riskAssessmentRequired, screeningOutcome,
// referralDisposition, sourcingType). These were added to ProcurementRequest
// after the bulk of the seed data was written, so most seeded requests carry
// none of them — the request-detail Compliance tab renders empty for them.
//
// Reuses the SAME decisioning functions the live wizard runs, rather than
// inventing separate logic. Signals a historical record never captured
// (data sensitivity, privileged access, policy-check outcomes, duplicate
// detection) default to their "nothing elevated / nothing wrong" value —
// the same posture the app takes anywhere else it doesn't know otherwise.
//
// Only fills fields the request does not already set — never overrides a
// real determination made by the wizard.

import type { ProcurementRequest, Supplier } from '../../data/types.js';
import { determineInherentRisk } from './risk-segmentation.js';
import { determineMateriality } from './materiality.js';
import { evaluateScreening } from './screening.js';
import { determineReferral } from './referral.js';
import { determineSourcingType } from './determination.js';

export type ComplianceBackfill = Pick<
  ProcurementRequest,
  | 'inherentRiskTier'
  | 'materialityTier'
  | 'riskAssessmentRequired'
  | 'screeningOutcome'
  | 'referralDisposition'
  | 'sourcingType'
>;

export function deriveComplianceBackfill(
  request: Pick<ProcurementRequest, 'value' | 'category' | 'buyingChannel' | 'supplierId'> &
    Partial<ComplianceBackfill>,
  supplier?: Pick<Supplier, 'riskRating' | 'screeningStatus'>,
): ComplianceBackfill {
  const inherentRisk = determineInherentRisk({
    value: request.value,
    supplierRiskRating: supplier?.riskRating,
  });
  const materiality = determineMateriality({
    value: request.value,
    riskRating: inherentRisk.tier,
  });
  const screening = evaluateScreening(supplier?.screeningStatus);
  const referral = determineReferral({
    missingMandatory: false,
    outOfScope: false,
    supplierBlocked: screening.blocking,
    failedPolicyChecks: 0,
    duplicateDetected: false,
  });
  const sourcing = determineSourcingType({
    channel: request.buyingChannel,
    category: request.category,
    hasExistingSupplierRelationship: !!request.supplierId,
  });

  return {
    inherentRiskTier: request.inherentRiskTier ?? inherentRisk.tier,
    materialityTier: request.materialityTier ?? materiality.criticality,
    riskAssessmentRequired: request.riskAssessmentRequired ?? inherentRisk.tier !== 'low',
    screeningOutcome: request.screeningOutcome ?? screening.status,
    referralDisposition: request.referralDisposition ?? referral.outcome,
    sourcingType: request.sourcingType ?? sourcing.type,
  };
}
