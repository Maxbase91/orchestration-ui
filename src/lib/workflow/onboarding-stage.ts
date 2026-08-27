// Vendor onboarding as two gates, not one stage.
//
// Onboarding sat exactly where risk sat before R4: a synthetic `ONBOARDING_STEP`
// spliced into the intake *preview* (`workflow-steps.ts:60`), with no
// `'onboarding'` status, no stage in any channel, and no node in any template.
// The preview promised a step that could never happen. Worse, its trigger was
// `!supplierId || !supplierData.complete` — stale master data — which is not the
// rule that matters.
//
// The rule that matters is: **a new supplier**. And it needs two different
// answers at two different moments, because the same vendor is asked for
// different things depending on what is about to happen to them:
//
//   LIGHT — the supplier exists in the system and has been screened.
//     Gates SOURCING, because you cannot invite a supplier that does not exist,
//     and gates COMPLETING THE RISK ASSESSMENT, because the assessment hangs off
//     a supplier record. Cheap, and needed early.
//
//   FULL — banking, certifications, master data: the whole onboarding.
//     Gates CONTRACTING, and only for the AWARDED supplier. Expensive, and only
//     justified once you know who won.
//
// Doing it as one gate would be wrong in both directions: demanding full
// onboarding before sourcing blocks every competitive event on paperwork for
// vendors who may not win, and demanding only light onboarding before
// contracting signs a contract with a vendor nobody can pay.
//
// `evaluateSupplierData` (`procurement/supplier-data.ts`) stays the master-data
// completeness rule and is deliberately NOT merged into this: it answers "is
// this record good enough to proceed", which is a different question from "how
// far through onboarding is this vendor", and collapsing them would hide both.

import type { Supplier } from '@/data/types';

/** What is still outstanding before this supplier can be transacted with. */
export type OnboardingLevel = 'none' | 'light' | 'full';

export interface OnboardingState {
  /** What is outstanding: `none` when nothing is. */
  outstanding: OnboardingLevel;
  /** Light onboarding done — the record exists and screening has run. */
  lightComplete: boolean;
  /** Full onboarding done. */
  fullComplete: boolean;
  reason: string;
}

/**
 * How far through onboarding a supplier is.
 *
 * No supplier at all is `light` outstanding, not `none`: a demand with no
 * supplier has not cleared onboarding, it simply has not chosen anyone yet, and
 * treating that as "nothing outstanding" is how the old
 * `!supplierId || !complete` trigger managed to fire on every request while
 * meaning nothing.
 */
export function onboardingState(supplier: Supplier | null | undefined): OnboardingState {
  if (!supplier) {
    return {
      outstanding: 'light',
      lightComplete: false,
      fullComplete: false,
      reason: 'No supplier has been identified yet.',
    };
  }

  // Screening is the substance of light onboarding: a record that exists but has
  // not been screened is not one you may invite to an event.
  const screened = supplier.screeningStatus === 'clear';
  const flagged = supplier.screeningStatus === 'flagged';
  const fullComplete = supplier.onboardingStatus === 'completed';
  const lightComplete = screened && !flagged;

  if (flagged) {
    return {
      outstanding: 'light',
      lightComplete: false,
      fullComplete: false,
      reason: `${supplier.name} is flagged by screening and cannot be onboarded until that is resolved.`,
    };
  }
  if (!lightComplete) {
    return {
      outstanding: 'light',
      lightComplete: false,
      fullComplete,
      reason: `${supplier.name} has not cleared screening yet (light onboarding).`,
    };
  }
  if (!fullComplete) {
    return {
      outstanding: 'full',
      lightComplete: true,
      fullComplete: false,
      reason: `${supplier.name} is screened but onboarding is ${supplier.onboardingStatus} — full onboarding is required before contracting.`,
    };
  }
  return {
    outstanding: 'none',
    lightComplete: true,
    fullComplete: true,
    reason: `${supplier.name} is fully onboarded.`,
  };
}

/**
 * May this request enter sourcing?
 *
 * A demand going out competitively with no supplier chosen is normal and must
 * not be blocked — that is the whole point of an event. The gate applies to a
 * NAMED supplier: if one has been identified, they must at least exist and be
 * screened before they can be invited.
 */
export function canEnterSourcing(supplier: Supplier | null | undefined): {
  allowed: boolean;
  reason: string;
} {
  if (!supplier) {
    return { allowed: true, reason: 'No supplier named — the event will go out to market.' };
  }
  const state = onboardingState(supplier);
  return state.lightComplete
    ? { allowed: true, reason: state.reason }
    : { allowed: false, reason: state.reason };
}

/**
 * Is the SUPPLIER ready for the risk stage to be completed?
 *
 * The assessment hangs off a supplier record, so there must be one, screened.
 * This is the gate that makes light onboarding worth doing early rather than at
 * award — it is the reason a new vendor has to be created before the risk work
 * can finish.
 *
 * Deliberately NOT named `canCompleteRiskStage`: `risk-stage.ts` already has one
 * of those, answering whether the ASSESSMENT is finished. Both must hold, and
 * one name for two questions would hide that.
 */
export function supplierReadyForRiskCompletion(supplier: Supplier | null | undefined): {
  allowed: boolean;
  reason: string;
} {
  if (!supplier) {
    return {
      allowed: false,
      reason: 'The risk assessment needs a supplier record — identify or create the supplier first.',
    };
  }
  const state = onboardingState(supplier);
  return state.lightComplete
    ? { allowed: true, reason: state.reason }
    : { allowed: false, reason: state.reason };
}

/**
 * May this request enter contracting?
 *
 * Only the awarded supplier, and only fully onboarded. This is the gate that has
 * to hold, because contracting is the point past which the platform commits.
 */
export function canEnterContracting(supplier: Supplier | null | undefined): {
  allowed: boolean;
  reason: string;
} {
  if (!supplier) {
    return { allowed: false, reason: 'No awarded supplier to contract with.' };
  }
  const state = onboardingState(supplier);
  return state.fullComplete
    ? { allowed: true, reason: state.reason }
    : { allowed: false, reason: state.reason };
}

/** A prospective supplier is one created from a demand and never transacted with. */
export function isProspective(supplier: Supplier | null | undefined): boolean {
  return Boolean((supplier as (Supplier & { prospective?: boolean }) | null)?.prospective);
}

/**
 * Does this request need the onboarding stage at all?
 *
 * The signal the workflow edge reads. Distinct from "onboarding is incomplete":
 * an established supplier mid-data-refresh does not need a demand to stop and
 * wait, whereas a vendor the platform has never dealt with does.
 */
export function onboardingRequired(supplier: Supplier | null | undefined): boolean {
  if (!supplier) return false;
  return isProspective(supplier) || !onboardingState(supplier).fullComplete;
}
