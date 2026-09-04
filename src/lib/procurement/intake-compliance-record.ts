// The compliance record an intake writes — one builder, both densities.
//
// This record is evidence. A reviewer reads it to decide whether the checks a
// request needed were actually done, and both intake paths were writing claims
// they had not earned:
//
//  * Expert wrote `duplicateCheck: { found: false, detail: 'No duplicate demand
//    detected at intake.' }`. **Nothing anywhere searches for duplicates.** The
//    sentence describes a search that has never existed, and `found: false`
//    without `performed` cannot distinguish "nothing matched" from "nobody
//    looked" — which is the whole point of the flag.
//  * Expert derived the SRA outcome by string-matching its own rendered label:
//    `formData.sraStatus.includes('expired') ? 'warning' : 'pass'`. A supplier
//    with `sraStatus: 'not-assessed'` contains neither word, so it recorded a
//    **pass** for an assessment that had never been performed. Change the label
//    text and the governance record changes with it.
//  * Simple wrote an honest `not-run` for both — but only because it ran no
//    checks at all, so the same demand produced two different records depending
//    on which screen the requester happened to be on.
//
// So the record is derived from the determination's structured fields, never
// from display strings, and a check that did not run says so.

import type { IntakeComplianceRecord } from '../../data/request-compliance.js';
import type { IntakeDetermination } from './intake-determination.js';

type SraCheck = IntakeComplianceRecord['sraCheck'];

/**
 * The supplier's SRA state, as evidence.
 *
 * Read from `supplierSraStatus` — the supplier record itself — rather than from
 * the sentence the screen displays. `not-assessed` is a **fail**, not a pass:
 * no assessment exists, which is exactly what a reviewer needs to know.
 */
function sraCheckFrom(determination: IntakeDetermination): SraCheck {
  const status = determination.supplierSraStatus;
  const name = determination.supplierName;

  if (!status) {
    return {
      status: 'not-applicable',
      detail: 'No supplier selected at intake — the SRA is assessed during supplier evaluation.',
    };
  }
  const expiry = determination.supplierSraExpiryDate;
  switch (status) {
    case 'valid':
      return { status: 'pass', detail: `${name} SRA valid${expiry ? ` until ${expiry}` : ''}.` };
    case 'expiring':
      return {
        status: 'warning',
        detail: `${name} SRA expiring${expiry ? ` on ${expiry}` : ''} — renewal needed before engagement.`,
      };
    case 'expired':
      return {
        status: 'fail',
        detail: `${name} SRA expired${expiry ? ` on ${expiry}` : ''} — reassessment required before engagement.`,
      };
    case 'not-assessed':
      return {
        status: 'fail',
        detail: `${name} has never been assessed — an SRA is required before engagement.`,
      };
    default:
      return { status: 'not-run', detail: `${name} SRA status is unknown — the assigned owner runs this check.` };
  }
}

/**
 * The flags a reviewer scans before opening the detail.
 *
 * Every entry is derived from a computed field, so a flag is present exactly
 * when the condition that produces it holds.
 */
function riskFlagsFrom(determination: IntakeDetermination): string[] {
  return [
    ...(determination.materiality.material ? ['material'] : []),
    `inherent-risk:${determination.inherentRisk.tier}`,
    ...(determination.riskAssessmentRequired ? ['risk-assessment-required'] : []),
    ...(determination.supplierOnboardingRequired ? ['supplier-onboarding-required'] : []),
    ...(determination.screening.blocking ? ['supplier-screening-blocked'] : []),
    ...(determination.referral.outcome !== 'proceed' ? [`disposition:${determination.referral.outcome}`] : []),
  ];
}

export interface BuildComplianceRecordOptions {
  /** ISO timestamp, injected so the same determination builds the same record. */
  determinedAt: string;
}

/**
 * Build the compliance record for a determined demand.
 *
 * Takes the determination rather than form state: the record and the screen
 * then cannot disagree, because they are reading one object.
 */
export function buildIntakeComplianceRecord(
  determination: IntakeDetermination,
  options: BuildComplianceRecordOptions,
): Omit<IntakeComplianceRecord, 'requestId'> {
  return {
    determinedAt: options.determinedAt,
    buyingChannel: {
      channel: determination.buyingChannelSlug,
      label: determination.buyingChannelResult,
      reasoning: determination.matchedRuleName
        ? `Matched routing rule "${determination.matchedRuleName}".`
        : 'No routing rule matched; the value-band fallback applied.',
    },
    sraCheck: sraCheckFrom(determination),
    policyChecks: determination.policyChecks,
    // `performed: false` is the load-bearing field. Until something actually
    // searches for duplicates, no record may imply that one came back clean.
    duplicateCheck: {
      found: false,
      performed: false,
      detail: 'No duplicate search runs at intake — the assigned owner checks for related demand.',
    },
    riskFlags: riskFlagsFrom(determination),
    matchingRiskAssessmentIds: determination.matchingRiskAssessments.map((r) => r.id),
  };
}

/**
 * The record for an intake that reached no determination.
 *
 * Only for a demand submitted before the checks could run (an unreachable
 * supplier directory, say). It asserts nothing: every check is `not-run`, which
 * is the honest reading of "we could not look".
 */
export function buildUndeterminedComplianceRecord(
  options: BuildComplianceRecordOptions & { channel: string; label: string },
): Omit<IntakeComplianceRecord, 'requestId'> {
  return {
    determinedAt: options.determinedAt,
    buyingChannel: {
      channel: options.channel,
      label: options.label,
      reasoning: 'Recorded from the route the requester took; no determination ran at intake.',
    },
    sraCheck: { status: 'not-run', detail: 'Not screened at intake — the assigned owner runs this check.' },
    policyChecks: [],
    duplicateCheck: { found: false, performed: false, detail: 'No duplicate search was run at intake.' },
    riskFlags: [],
    matchingRiskAssessmentIds: [],
  };
}
