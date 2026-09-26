// What may be recorded about a supplier's screening, risk assessment and
// onboarding — and only on evidence (decided 2026-09-26).
//
// The supplier's Risk tab had "Approve risk", which wrote screening *clear* and
// the risk assessment *valid* although nothing had been screened or assessed,
// and "Refer back", which wrote screening *flagged* on the same nothing; both
// reset a completed supplier's onboarding to in progress, and the rationale
// they asked for was thrown away. The onboarding pipeline's Complete likewise
// asked for a note and dropped it. A pass recorded for a check nobody ran is
// worse than no record at all (AGENTS.md rule 3), so each write here needs the
// evidence it stands on:
//
//   - a screening result names the screening that produced it — its reference
//     and the day it was performed — because there is no live screening in
//     Release 1 and the platform cannot run one itself;
//   - the supplier risk assessment (SRA) is a completed, in-date assessment of
//     this supplier from the register, linked by id; its expiry is the
//     assessment's own;
//   - completing onboarding needs a clear screening on record, and its note is
//     kept.
//
// None of them touches onboarding except the completion, which is its job.
// Pure and dependency-free: the screens call these, and a Node suite drives them.

import type { RiskAssessment, Supplier } from '../../data/types.js';
import { isoToday } from './contract-status.js';

/** An audit-log entry the caller writes with the change. */
export interface EvidenceAudit {
  action: string;
  detail: string;
}

export type EvidencePlan<P> =
  | { ok: true; patch: P; audit: EvidenceAudit }
  | { ok: false; error: string };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export interface ScreeningRecordInput {
  result: string;
  /** Where the screening ran — the provider and its case or report number. */
  reference: string;
  /** The day it was performed, as an ISO date. */
  performedOn: string;
  notes?: string;
}

/** Record a screening that was performed elsewhere, by its reference. */
export function planScreeningRecord(
  input: ScreeningRecordInput,
  today: string = isoToday(),
): EvidencePlan<Pick<Supplier, 'screeningStatus' | 'screeningReference' | 'screeningDate'>> {
  if (input.result !== 'clear' && input.result !== 'flagged') {
    return { ok: false, error: 'Choose the screening result: clear or flagged.' };
  }
  const reference = input.reference.trim();
  if (!reference) {
    return { ok: false, error: 'Give the screening’s reference — the provider and its case or report number.' };
  }
  if (reference.length > 200) return { ok: false, error: 'Keep the reference under 200 characters.' };
  if (!ISO_DAY.test(input.performedOn)) return { ok: false, error: 'Give the day the screening was performed.' };
  if (input.performedOn > today) return { ok: false, error: 'A screening cannot be recorded before it is performed.' };
  const notes = input.notes?.trim();
  return {
    ok: true,
    patch: { screeningStatus: input.result, screeningReference: reference, screeningDate: input.performedOn },
    audit: {
      action: 'supplier.screening-recorded',
      detail: `Screening ${input.result} — ${reference}, performed ${input.performedOn}${notes ? `. ${notes}` : ''}`,
    },
  };
}

/** Is this assessment one that can stand behind the supplier's SRA today? */
function whyNotLinkable(assessment: RiskAssessment, supplierId: string, today: string): string | null {
  if (assessment.supplierId !== supplierId) return 'That assessment is not of this supplier.';
  if (assessment.status !== 'completed') return 'Only a completed assessment can stand behind the SRA.';
  if (!ISO_DAY.test((assessment.validUntil ?? '').slice(0, 10))) return 'That assessment has no validity date.';
  if (assessment.validUntil.slice(0, 10) < today) return 'That assessment is out of date.';
  return null;
}

/** The completed, in-date assessments of this supplier, soonest to expire last. */
export function linkableAssessments(
  assessments: readonly RiskAssessment[],
  supplierId: string,
  today: string = isoToday(),
): RiskAssessment[] {
  return assessments
    .filter((a) => whyNotLinkable(a, supplierId, today) === null)
    .sort((a, b) => b.validUntil.localeCompare(a.validUntil));
}

/** Set the SRA from a completed, in-date assessment of this supplier. */
export function planAssessmentLink(
  assessment: RiskAssessment | undefined,
  supplierId: string,
  today: string = isoToday(),
): EvidencePlan<Pick<Supplier, 'sraStatus' | 'sraExpiryDate' | 'sraAssessmentId'>> {
  if (!assessment) return { ok: false, error: 'Choose a completed risk assessment of this supplier.' };
  const refused = whyNotLinkable(assessment, supplierId, today);
  if (refused) return { ok: false, error: refused };
  const validUntil = assessment.validUntil.slice(0, 10);
  return {
    ok: true,
    patch: { sraStatus: 'valid', sraExpiryDate: validUntil, sraAssessmentId: assessment.id },
    audit: {
      action: 'supplier.sra-linked',
      detail: `SRA from ${assessment.id} (${assessment.title}), completed by ${assessment.assessorName} on ${assessment.assessedAt.slice(0, 10)}, valid until ${validUntil}`,
    },
  };
}

/** Why onboarding cannot be completed yet, or null when it can. */
export function onboardingCompletionBlock(supplier: Pick<Supplier, 'screeningStatus'>): string | null {
  return supplier.screeningStatus === 'clear' ? null : 'Needs a clear screening on record';
}

/** Complete onboarding: a clear screening on record, and the note kept. */
export function planOnboardingCompletion(
  supplier: Pick<Supplier, 'screeningStatus' | 'onboardingStatus'>,
  note: string,
): EvidencePlan<Pick<Supplier, 'onboardingStatus'>> {
  const block = onboardingCompletionBlock(supplier);
  if (block) return { ok: false, error: `${block} before onboarding can be completed.` };
  if (supplier.onboardingStatus === 'completed') return { ok: false, error: 'Onboarding is already complete.' };
  const text = note.trim();
  if (!text) return { ok: false, error: 'Add a completion note — what was checked.' };
  return {
    ok: true,
    patch: { onboardingStatus: 'completed' },
    audit: { action: 'supplier.onboarding-completed', detail: text },
  };
}

/**
 * The onboarding status the supplier portal's form may write: it starts
 * onboarding, and never takes back a completed one — the form used to set
 * "in progress" on every save, which then blocked contracting at award.
 */
export function portalOnboardingStatus(current: Supplier['onboardingStatus']): Supplier['onboardingStatus'] {
  return current === 'completed' ? 'completed' : 'in-progress';
}
