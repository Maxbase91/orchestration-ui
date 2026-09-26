// What the Channel page lists under "Checks": the conclusions a requester should
// see before they submit, each one a verdict, its reason and a tone.
//
// It replaces the Review step's stack of fifteen cards, which put the channel
// decision, three risk readings, two approval panels, the contract check and
// every policy result at one weight, so a requester could not find the three
// that mattered to them. Every line here is read from the same object submit
// records — the intake determination, or the governed decision for a call-off —
// and nothing is computed twice. The workings stay one click away on the page,
// and in the export.
//
// A check that could not run says so or is left out. It is never shown as clear:
// approvers still loading produce no line rather than "No approval needed".
//
// Pure, with relative imports, so a node test drives it.
import type { IntakeDetermination } from './intake-determination.js';
import type { GovernedCheckoutDecision } from './governed-checkout.js';
import type { DerivedApproval } from './approval-derivation.js';
import type { SecondCheckRecommendation } from './second-contract-check.js';
import { formatCurrency } from '../format.js';

export type CheckTone = 'ok' | 'warn' | 'stop' | 'neutral';

/**
 * A reason as a sentence. The determination's reasons are written as fragments
 * for other screens ("new or unselected supplier"); set under a verdict they
 * read as sentences.
 */
function sentence(text: string): string {
  const t = text.trim();
  if (!t) return t;
  const capital = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(capital) ? capital : `${capital}.`;
}

export interface ChannelCheck {
  tone: CheckTone;
  verdict: string;
  reason: string;
}

/** The approvers submit will write, as one line; null while they load. */
export function approvalsCheck(approvers: readonly DerivedApproval[] | null): ChannelCheck | null {
  if (approvers === null) return null;
  if (approvers.length === 0) {
    return { tone: 'ok', verdict: 'No approval needed', reason: 'The approval chain for this value has no steps.' };
  }
  // A person is named with the role they approve as; a role entry already
  // reads as one ("Category Manager — A or B").
  const who = [...approvers]
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .map((a) => (a.assignmentMode === 'person' ? `${a.approverName} (${a.role})` : a.approverName));
  return {
    tone: 'neutral',
    verdict: approvers.length === 1 ? 'One approval' : `${approvers.length} approvals, in order`,
    reason: `${who.join(', then ')}.`,
  };
}

/** The contract check's recommendation, in the requester's words. */
const CONTRACT_VERDICT: Record<SecondCheckRecommendation, { tone: CheckTone; verdict: string }> = {
  transact: { tone: 'ok', verdict: 'A contract covers this' },
  'author-sow': { tone: 'neutral', verdict: 'A framework covers this' },
  renew: { tone: 'warn', verdict: 'The covering contract is expiring' },
  'new-contract': { tone: 'neutral', verdict: 'No contract covers this yet' },
};

export interface RequestChecksInput {
  determination: IntakeDetermination;
  approvers: readonly DerivedApproval[] | null;
  /** Labels of sections the demand makes mandatory that the description lacks. */
  missingSections: readonly string[];
  /** Whether the chosen supplier is on the category's preferred list; null when none is chosen. */
  supplierPreferred: boolean | null;
  /** The chosen supplier is outside the list and the category manager must agree (Decisioning thresholds). */
  overrideNeedsApproval: boolean;
  /** How many suppliers sourcing will invite, and how many of them are preferred; null when nothing is sourced. */
  sourcingInvites: { total: number; preferred: number } | null;
}

/** The checks for a full request, most consequential first. */
export function requestChecks(input: RequestChecksInput): ChannelCheck[] {
  const d = input.determination;
  const checks: ChannelCheck[] = [];

  // Why this channel: the rule that chose it, in the words its author wrote.
  checks.push({
    tone: 'neutral',
    verdict: d.buyingChannelResult,
    reason: d.matchedRuleDescription?.trim()
      || (d.matchedRuleName ? `Routing rule: ${d.matchedRuleName}.` : 'No routing rule matched, so the value band decided.'),
  });

  if (d.referral.outcome !== 'proceed') {
    checks.push({
      tone: d.referral.outcome === 'refer-back' ? 'stop' : 'warn',
      verdict: d.referral.outcome === 'refer-back' ? 'It will be referred back' : 'A change will be asked for',
      reason: sentence(d.referral.reason),
    });
  }

  // Screening means something only for a supplier someone chose; with none,
  // "not yet screened" is the expected state, not a finding.
  if (d.supplierName && !d.screening.cleared) {
    checks.push({
      tone: d.screening.blocking ? 'stop' : 'warn',
      verdict: d.screening.blocking ? `${d.supplierName} is flagged in screening` : `${d.supplierName} is not screened yet`,
      reason: sentence(d.screening.message),
    });
  }

  const contract = CONTRACT_VERDICT[d.secondContractCheck.recommendation];
  checks.push({ tone: contract.tone, verdict: contract.verdict, reason: sentence(d.secondContractCheck.reason) });

  // Nobody invited yet is not a finding — the Supplier section says who will
  // choose — so only an invitation list earns a line here.
  if (input.sourcingInvites && input.sourcingInvites.total > 0) {
    const { total, preferred } = input.sourcingInvites;
    checks.push({
      tone: 'ok',
      verdict: `${total} supplier${total === 1 ? '' : 's'} invited to sourcing`,
      reason: preferred > 0
        ? `Including ${preferred === total ? (total === 1 ? 'the' : 'all') : preferred} preferred supplier${preferred === 1 ? '' : 's'} for this category. Procurement can add others when the event starts.`
        : 'The ones you named. Procurement can add others when the event starts.',
    });
  } else if (!input.sourcingInvites && input.supplierPreferred === false) {
    checks.push({
      tone: 'warn',
      verdict: 'Supplier outside the preferred list',
      reason: input.overrideNeedsApproval
        ? 'Your reason goes with the request, and the category manager approves the choice.'
        : 'Your reason goes with the request.',
    });
  }

  const reused = d.matchingRiskAssessments[0];
  checks.push(d.riskAssessmentRequired
    ? { tone: 'warn', verdict: 'Risk assessment needed', reason: sentence(d.triageReason) }
    : reused
      ? { tone: 'ok', verdict: 'Risk assessment reused', reason: `${reused.title}, valid until ${reused.validUntil}.` }
      : { tone: 'ok', verdict: 'No risk assessment needed', reason: sentence(d.triageReason) });

  const approvals = approvalsCheck(input.approvers);
  if (approvals) checks.push(approvals);

  // With the validator off, the determination records one failing entry
  // telling an administrator to enable it — an instruction for Admin, not for
  // the person submitting. They are told what it means for them instead.
  if (d.validatorAgentStatus !== 'active') {
    checks.push({
      tone: 'warn',
      verdict: 'Policy checks did not run',
      reason: 'The request validator is switched off, so nothing was checked against policy. Reviewers see this on the request.',
    });
  } else {
    for (const check of d.policyChecks.filter((c) => !c.passed)) {
      checks.push({ tone: 'warn', verdict: check.label, reason: sentence(check.detail) });
    }
  }

  if (input.missingSections.length > 0) {
    const n = input.missingSections.length;
    checks.push({
      tone: 'warn',
      verdict: `The service description lacks ${n} required section${n === 1 ? '' : 's'}`,
      reason: `${input.missingSections.join(', ')}. You can still submit, but a reviewer will ask.`,
    });
  }
  return checks;
}

export interface CallOffChecksInput {
  decision: GovernedCheckoutDecision;
  contract: { title: string; supplierName: string; endDate: string };
  /** The assessment the call-off reuses, when there is one. */
  riskAssessment?: { title: string; validUntil: string } | null;
  approvers: readonly DerivedApproval[] | null;
  directCallOffLimit: number;
  autoApprovalThreshold: number;
}

/** The checks for a contract call-off, from the governed decision submit re-runs on the server. */
export function callOffChecks(input: CallOffChecksInput): ChannelCheck[] {
  const { decision, contract } = input;
  const checks: ChannelCheck[] = [];
  for (const error of decision.errors) checks.push({ tone: 'stop', verdict: 'It cannot be placed as it stands', reason: sentence(error) });

  checks.push({
    tone: 'ok',
    verdict: 'The contract can be called off',
    reason: `${contract.title} with ${contract.supplierName}, in force to ${contract.endDate}.`,
  });
  checks.push({
    tone: 'ok',
    verdict: 'Within the direct call-off limit',
    reason: `${formatCurrency(decision.totalValue)} is at or below ${formatCurrency(input.directCallOffLimit)}, so there is no mini-competition.`,
  });
  if (decision.contractAmendmentRequired) {
    checks.push({
      tone: 'warn',
      verdict: 'The contract is amended first',
      reason: decision.warnings.find((w) => /amend|capacity|contract/i.test(w)) ?? 'The call-off does not fit the contract as it stands.',
    });
  }
  checks.push(decision.riskReviewRequired
    ? {
        tone: 'warn',
        verdict: 'Risk review first',
        reason: decision.warnings.find((w) => /risk/i.test(w)) ?? 'The supplier has no valid assessment for this.',
      }
    : input.riskAssessment
      ? { tone: 'ok', verdict: 'Risk assessment reused', reason: `${input.riskAssessment.title}, valid until ${input.riskAssessment.validUntil}.` }
      : { tone: 'ok', verdict: 'No risk review needed', reason: 'The supplier\'s assessment covers this call-off.' });

  if (decision.approvalRequired) {
    const approvals = approvalsCheck(input.approvers);
    if (approvals) checks.push(approvals);
  } else {
    checks.push({
      tone: 'ok',
      verdict: 'No approval needed',
      reason: `Up to ${formatCurrency(input.autoApprovalThreshold)} is approved automatically, so the purchase order is raised when you submit.`,
    });
  }
  return checks;
}
