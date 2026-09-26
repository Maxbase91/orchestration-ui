// What changed between the determination a requester reviewed and the one
// submit reaches on the server, in words the Channel page can show.
//
// Submit decides every demand again from stored data (AGENTS.md rule 3) and
// refuses when the answer differs from what the requester reviewed — nothing
// is written, and they review the Channel page again (decided 2026-09-26). It
// used to store the browser's determination and compliance record as sent, so
// a stale page, or an edited request, decided the record.
//
// Compared: what the Channel page showed and the request records — the
// channel, the approval chain, sourcing type, the inherent-risk and
// materiality tiers, whether a risk assessment is needed, screening, the
// disposition, the SRA outcome, each policy check's result, the assessments
// that can be reused, vendor onboarding and the risk questions asked. Not
// compared: sentences, which follow from those values, and when it was
// decided. Pure, and dependency-free apart from the channel labels, so the
// server and a Node suite both run it.
//
// Relative '.js' specifiers only: api/ imports this.

import type { IntakeComplianceRecord } from '../../data/request-compliance.js';
import { buyingChannelLabel } from '../routing/evaluate-routing-rules.js';
import { recordedDetermination, type IntakeDetermination } from './intake-determination.js';

/** One side of the comparison, reduced to the values a person decided on. */
export interface DeterminationSummary {
  buyingChannel: string | null;
  approvalChain: string | null;
  sourcingType: string | null;
  inherentRiskTier: string | null;
  materialityTier: string | null;
  riskAssessmentRequired: boolean;
  screeningOutcome: string | null;
  referralDisposition: string | null;
  sraCheck: string | null;
  policyChecks: { label: string; passed: boolean }[];
  reusableAssessmentIds: string[];
  riskFlags: string[];
}

type ComplianceRecord = Omit<IntakeComplianceRecord, 'requestId'>;

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);
const record = (value: unknown): Record<string, unknown> =>
  (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {});

/**
 * What the requester reviewed, read from what the browser sent: the request's
 * determination fields and its compliance record. Read defensively — it is
 * client input, and a missing record compares as "nothing reviewed", which
 * differs from any real determination and is refused.
 */
export function reviewedSummary(request: Record<string, unknown>, compliance: unknown): DeterminationSummary {
  const sent = record(compliance);
  return {
    buyingChannel: text(request.buyingChannel),
    approvalChain: text(request.approvalChain),
    sourcingType: text(request.sourcingType),
    inherentRiskTier: text(request.inherentRiskTier),
    materialityTier: text(request.materialityTier),
    riskAssessmentRequired: request.riskAssessmentRequired === true,
    screeningOutcome: text(request.screeningOutcome),
    referralDisposition: text(request.referralDisposition),
    sraCheck: text(record(sent.sraCheck).status),
    policyChecks: (Array.isArray(sent.policyChecks) ? sent.policyChecks : [])
      .map(record)
      .filter((check) => typeof check.label === 'string')
      .map((check) => ({ label: String(check.label), passed: check.passed === true })),
    reusableAssessmentIds: strings(sent.matchingRiskAssessmentIds),
    riskFlags: strings(sent.riskFlags),
  };
}

/** What submit decided, from its own determination and compliance record. */
export function decidedSummary(determination: IntakeDetermination, compliance: ComplianceRecord): DeterminationSummary {
  const recorded = recordedDetermination(determination);
  return {
    buyingChannel: recorded.buyingChannel,
    approvalChain: recorded.approvalChain ?? null,
    sourcingType: recorded.sourcingType,
    inherentRiskTier: recorded.inherentRiskTier,
    materialityTier: recorded.materialityTier,
    riskAssessmentRequired: recorded.riskAssessmentRequired,
    screeningOutcome: recorded.screeningOutcome,
    referralDisposition: recorded.referralDisposition,
    sraCheck: compliance.sraCheck.status,
    policyChecks: compliance.policyChecks.map((check) => ({ label: check.label, passed: check.passed })),
    reusableAssessmentIds: compliance.matchingRiskAssessmentIds ?? [],
    riskFlags: compliance.riskFlags,
  };
}

/** A value as the Channel page words it: "not-screened" → "not screened". */
const words = (value: string | null): string => (value ? value.replace(/-/g, ' ') : 'none');

/**
 * Each difference as a sentence, most consequential first; empty when the two
 * agree. `chainName` turns a chain id into the name the Channel page showed.
 */
export function determinationChanges(
  reviewed: DeterminationSummary,
  decided: DeterminationSummary,
  chainName: (id: string | null) => string,
): string[] {
  const changes: string[] = [];
  const changed = (a: string | null, b: string | null) => (a ?? null) !== (b ?? null);

  if (changed(reviewed.buyingChannel, decided.buyingChannel)) {
    const label = (slug: string | null) => (slug ? buyingChannelLabel(slug) : 'none');
    changes.push(`The buying channel is now ${label(decided.buyingChannel)} (you reviewed ${label(reviewed.buyingChannel)}).`);
  }
  if (changed(reviewed.approvalChain, decided.approvalChain)) {
    changes.push(`The approval chain is now ${chainName(decided.approvalChain)} (you reviewed ${chainName(reviewed.approvalChain)}).`);
  }
  if (changed(reviewed.referralDisposition, decided.referralDisposition)) {
    changes.push(`The disposition is now ${words(decided.referralDisposition)} (you reviewed ${words(reviewed.referralDisposition)}).`);
  }
  if (changed(reviewed.screeningOutcome, decided.screeningOutcome)) {
    changes.push(`Supplier screening is now ${words(decided.screeningOutcome)} (you reviewed ${words(reviewed.screeningOutcome)}).`);
  }
  if (reviewed.riskAssessmentRequired !== decided.riskAssessmentRequired) {
    changes.push(decided.riskAssessmentRequired ? 'A risk assessment is now required.' : 'A risk assessment is no longer required.');
  }
  if (changed(reviewed.inherentRiskTier, decided.inherentRiskTier)) {
    changes.push(`The inherent risk is now ${words(decided.inherentRiskTier)} (you reviewed ${words(reviewed.inherentRiskTier)}).`);
  }
  if (changed(reviewed.materialityTier, decided.materialityTier)) {
    changes.push(`Materiality is now ${words(decided.materialityTier)} (you reviewed ${words(reviewed.materialityTier)}).`);
  }
  if (changed(reviewed.sourcingType, decided.sourcingType)) {
    changes.push(`The sourcing type is now ${words(decided.sourcingType)} (you reviewed ${words(reviewed.sourcingType)}).`);
  }
  if (changed(reviewed.sraCheck, decided.sraCheck)) {
    changes.push(`The supplier's risk assessment check is now ${words(decided.sraCheck)} (you reviewed ${words(reviewed.sraCheck)}).`);
  }

  const before = new Map(reviewed.policyChecks.map((check) => [check.label, check.passed]));
  const after = new Map(decided.policyChecks.map((check) => [check.label, check.passed]));
  for (const [label, passed] of after) {
    if (!before.has(label)) changes.push(`The check "${label}" now applies and ${passed ? 'passes' : 'fails'}.`);
    else if (before.get(label) !== passed) changes.push(`The check "${label}" now ${passed ? 'passes' : 'fails'}.`);
  }
  for (const label of before.keys()) {
    if (!after.has(label)) changes.push(`The check "${label}" no longer applies.`);
  }

  const sameSet = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && [...a].sort().every((value, i) => value === [...b].sort()[i]);
  if (!sameSet(reviewed.reusableAssessmentIds, decided.reusableAssessmentIds)) {
    changes.push('The risk assessments that can be reused have changed.');
  }

  // Of the flags, only the two no field above carries: the rest restate the
  // tiers, the risk assessment, screening and the disposition already compared.
  const onboarding = (flags: string[]) => flags.includes('supplier-onboarding-required');
  if (onboarding(reviewed.riskFlags) !== onboarding(decided.riskFlags)) {
    changes.push(onboarding(decided.riskFlags) ? 'Vendor onboarding is now required.' : 'Vendor onboarding is no longer required.');
  }
  const questions = (flags: string[]) => flags.filter((flag) => flag.startsWith('risk-question:'));
  if (!sameSet(questions(reviewed.riskFlags), questions(decided.riskFlags))) {
    changes.push('The risk questions this demand needs answered have changed.');
  }
  return changes;
}
