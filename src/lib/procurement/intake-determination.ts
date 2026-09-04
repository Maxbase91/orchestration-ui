// The intake determination — every conclusion the front door reaches about a
// demand, computed once, from data, with no React in sight.
//
// This was a `useMemo` inside `step-compliance.tsx`. That placement had three
// costs worth naming, because each one had already been paid:
//
//  1. **It could not be tested.** The most consequential decision the platform
//     makes — channel, risk tier, whether a risk assessment is required, what
//     the compliance record will say — was reachable only by mounting a wizard
//     step. Every other decision of this weight in this codebase (routing,
//     classification, intake routing) is a pure benchmarked module.
//  2. **Only one of the two intake pages ran it.** Simple intake never mounted the step, so it
//     wrote `sraCheck: not-run`, `policyChecks: []` while Expert wrote real
//     results — two governance records for the same demand, decided by which
//     screen the requester happened to be on.
//  3. **It read the clock.** Three `new Date()` calls inside the memo meant the
//     same inputs could produce different outputs, which is the one thing a
//     determination must never do.
//
// So: inputs in, determination out, `now` injected. There is deliberately **no
// `density` or `mode` parameter anywhere in this module**, and
// `tests/integration/mode-equivalence.mjs` asserts that structurally. The
// Simple/Expert switch has since been removed entirely, but the rule stands on
// its own: how a screen presents a determination may not reach into how the
// determination is reached.

import { formatCurrency } from '../format.js';
import { isPreferredSupplier, competitiveSourcingCheck, preferredSupplierCheck } from './supplier-preference.js';
import { inferDataSensitivity } from './demand-signals.js';
import { determineMateriality, type MaterialityResult } from './materiality.js';
import { determineInherentRisk, type InherentRiskResult } from './risk-segmentation.js';
import { selectReuseOutcome, type ReuseEvaluation } from './risk-reuse.js';
import { buildHandoffSteps, type HandoffStep } from './handoff.js';
import { evaluateSupplierData } from './supplier-data.js';
import { determineContractType, determineSourcingType, type ContractType, type SourcingType } from './determination.js';
import { runSecondContractCheck, type SecondContractCheckResult } from './second-contract-check.js';
import { determineApprovalToSource, type ApprovalToSourceResult } from './approval-to-source.js';
import { determineResidualQuestions, type ResidualQuestion } from './residual-questions.js';
import { assessOperationalRisk, type OperationalRiskResult } from './operational-risk-assessment.js';
import { determineReferral, type ReferralResult } from './referral.js';
import { evaluateScreening, type ScreeningResult } from './screening.js';
import { isTriageRequired } from './risk-triage.js';
import { evaluatePCardEligibility } from '../routing/p-card.js';
import { buyingChannelLabel } from '../routing/evaluate-routing-rules.js';
import { resolveDemandChannel } from '../routing/demand-channel.js';
import { selectApprovalChainForValue } from '../workflow/workflow-steps.js';
import type { ApprovalChain } from '../db/approval-chains.js';
import type { Supplier, Contract, RoutingRule, RiskAssessment, BuyingChannel } from '../../data/types.js';

/** The sections of a service description the risk read looks at. */
export interface DeterminationServiceDescription {
  objective?: string;
  scope?: string;
  deliverables?: string;
  resources?: string;
  narrative?: string;
}

export interface MatchingRiskAssessmentSummary {
  id: string;
  title: string;
  riskLevel: RiskAssessment['riskLevel'];
  category: RiskAssessment['category'];
  validUntil: string;
}

export interface IntakeDeterminationInput {
  category: string;
  estimatedValue: number;
  supplierId: string;
  isUrgent: boolean;
  requestTitle?: string;
  serviceDescription?: DeterminationServiceDescription | null;
  /** The two inherent-risk attributes a service description cannot reveal. */
  miniIrq: { privilegedAccess: boolean; criticalService: boolean };
  /** A contract the buy-route step already matched, when there is one. */
  contractId?: string;
  /** Today, as YYYY-MM-DD. Injected so the same inputs always give one answer. */
  now: string;
  suppliers: Supplier[];
  contracts: Contract[];
  /** Reusable, completed, in-validity assessments for this supplier. */
  matchingRiskAssessments: RiskAssessment[];
  routingRules: RoutingRule[];
  approvalChains: ApprovalChain[];
  /** AI-002 Request Validator. Policy checks only run when it is active. */
  validatorAgent?: { name: string; status: string };
}

export interface IntakeDetermination {
  /** The display form — "Procurement-Led Sourcing". */
  buyingChannelResult: string;
  /**
   * The slug alongside the label. `buyingChannelResult` was once written
   * straight into `requests.buying_channel`, where every consumer keys on the
   * slug — so `getStagesForChannel` always missed and fell back to the full
   * lifecycle.
   */
  buyingChannelSlug: BuyingChannel;
  approvalChain?: string;
  matchedRuleName?: string;
  materiality: MaterialityResult;
  inherentRisk: InherentRiskResult;
  operationalRisk: OperationalRiskResult;
  riskOutcome: ReuseEvaluation;
  contractType: { type: ContractType; reason: string };
  sourcingType: { type: SourcingType; reason: string };
  secondContractCheck: SecondContractCheckResult;
  approvalToSource: ApprovalToSourceResult;
  residualQuestions: ResidualQuestion[];
  referral: ReferralResult;
  screening: ScreeningResult;
  handoffSteps: HandoffStep[];
  /** The data sensitivity inferred from the description, kept for the triage view. */
  dataSensitivity: ReturnType<typeof inferDataSensitivity>;
  /** Whether the P-card route is open to this demand, and why not when it isn't. */
  pCardEligible: boolean;
  pCardIneligibleReasons: string[];
  sraStatus: string;
  /** The supplier's own SRA state, for a record that must not guess. */
  supplierSraStatus?: Supplier['sraStatus'];
  supplierSraExpiryDate?: string;
  supplierName?: string;
  policyChecks: { label: string; passed: boolean; detail: string }[];
  /**
   * Null until something actually searches for duplicates. Nothing does, so
   * nothing may record that a duplicate check passed.
   */
  duplicateCheck: string | null;
  matchingRiskAssessments: MatchingRiskAssessmentSummary[];
  validatorAgentStatus: 'active' | 'draft' | 'disabled' | 'missing';
  validatorAgentName?: string;
  /**
   * Determination signals that overlay conditional steps on the routing
   * lifecycle: a risk assessment when none can be reused and the demand is
   * triage-worthy/high-risk; vendor onboarding when no/incomplete supplier.
   */
  riskAssessmentRequired: boolean;
  supplierOnboardingRequired: boolean;
  triageRequired: boolean;
  /** Why triage is or is not required, in the gate's own words. */
  triageReason: string;
}

/**
 * The policy checks, which only run when the Request Validator agent is active.
 *
 * When it is not, the single "agent unavailable" entry is the honest answer:
 * a disabled validator has checked nothing, and an empty list would read as
 * "all clear".
 */
export function generatePolicyChecks(
  value: number,
  category: string,
  supplierId: string,
  suppliers: Supplier[],
): { label: string; passed: boolean; detail: string }[] {
  const supplier = suppliers.find((s) => s.id === supplierId);
  const checks: { label: string; passed: boolean; detail: string }[] = [];

  checks.push({
    label: 'Contract required before PO',
    passed: value < 25000 || (supplier !== undefined && supplier.activeContracts > 0),
    detail:
      value < 25000
        ? 'Value below threshold; PO can proceed without contract'
        : supplier && supplier.activeContracts > 0
          ? `Existing contract found with ${supplier.name}`
          : 'No existing contract found; contract must be executed before PO',
  });

  checks.push({
    label: 'Budget approval required',
    passed: value <= 100000,
    detail:
      value > 100000
        ? `Value (${formatCurrency(value)}) exceeds standard threshold; VP approval required`
        : 'Within standard approval limits',
  });

  checks.push({
    label: 'SRA assessment valid',
    passed: supplier ? supplier.sraStatus === 'valid' : false,
    detail: supplier
      ? supplier.sraStatus === 'valid'
        ? `SRA valid until ${supplier.sraExpiryDate}`
        : supplier.sraStatus === 'expiring'
          ? `SRA expiring on ${supplier.sraExpiryDate}; renewal recommended`
          : 'SRA assessment required before engagement'
      : 'Supplier not selected; SRA status unknown',
  });

  const isPreferred = isPreferredSupplier(supplier);
  checks.push(competitiveSourcingCheck({ value, category, isPreferred }));
  checks.push(preferredSupplierCheck({ supplier, isPreferred }));

  return checks;
}

/**
 * Everything the front door concludes about a demand.
 *
 * Order matters in one place worth calling out: materiality and the inherent
 * risk tier are computed *before* the channel, because two of the ten live
 * routing rules read them. Resolving the channel first would silently answer a
 * different question.
 */
export function evaluateIntakeDetermination(input: IntakeDeterminationInput): IntakeDetermination {
  const {
    category, estimatedValue, supplierId, isUrgent, requestTitle, serviceDescription,
    miniIrq, contractId, now, suppliers, contracts, matchingRiskAssessments: matches,
    routingRules, approvalChains, validatorAgent,
  } = input;

  const supplierRec = suppliers.find((s) => s.id === supplierId);
  const dataSensitivity = inferDataSensitivity(serviceDescription ?? null);

  const materiality = determineMateriality({
    dataSensitivity,
    riskRating: supplierRec?.riskRating,
    value: estimatedValue,
    criticalService: miniIrq.criticalService,
  });

  // Inherent-risk cascade — the demand's risk tier (richer than supplier risk
  // alone), which drives routing and the assessment outcome. The mini-IRQ
  // delta answers feed the attributes the SOW cannot reveal.
  const inherentRisk = determineInherentRisk({
    dataSensitivity,
    supplierRiskRating: supplierRec?.riskRating,
    value: estimatedValue,
    privilegedAccess: miniIrq.privilegedAccess,
    criticalService: miniIrq.criticalService,
  });

  // Residual questions — only the deltas the description leaves open and that
  // would change the determination; an empty list means nothing to ask.
  const residualQuestions = determineResidualQuestions({
    category,
    dataSensitivity,
    estimatedValue,
    supplierRiskRating: supplierRec?.riskRating,
  });

  // Preliminary operational risk — a per-dimension operational view
  // (continuity, data, concentration, regulatory, access) complementing the
  // single-tier inherent-risk cascade.
  const incumbentRelationship = (supplierRec?.activeContracts ?? 0) > 0 || (supplierRec?.totalSpend12m ?? 0) > 0;
  const operationalRisk = assessOperationalRisk({
    dataSensitivity,
    material: materiality.material,
    criticalService: miniIrq.criticalService,
    privilegedAccess: miniIrq.privilegedAccess,
    estimatedValue,
    incumbentRelationship,
  });

  // Structured reuse decision against the third-party risk register —
  // factors supplier, scope, data class, inherent tier and validity.
  const riskOutcome = selectReuseOutcome(
    { supplierId, category, dataSensitivity, inherentTier: inherentRisk.tier, now },
    matches,
  );

  // P-card eligibility is a routing *input*, not a separate opinion. Simple
  // intake supplied it and the determination did not, so the same demand could
  // be offered a card route on one screen and a sourcing exercise on another.
  const pCard = evaluatePCardEligibility({
    category,
    value: estimatedValue,
    isUrgent,
    material: materiality.material,
    riskRating: inherentRisk.tier,
  });

  // The same resolver the buy-route step calls, so the channel shown there and
  // the one determined here cannot drift apart.
  const routing = resolveDemandChannel(routingRules, {
    category,
    value: estimatedValue,
    supplierId,
    contractId,
    isUrgent,
    riskRating: inherentRisk.tier,
    material: materiality.material,
    pCardEligible: pCard.eligible,
  });

  // `requests.approval_chain` is an FK to approval_chains.id. Routing rules
  // use human-readable role vocabularies, so persist the actual configured
  // chain selected by the same value band shown in the routing preview.
  const configuredChain = approvalChains.find((chain) => chain.id === routing.approvalChain);
  const valueBandedChain = selectApprovalChainForValue(approvalChains, estimatedValue);
  const label = buyingChannelLabel(routing.channel);
  const supplierData = evaluateSupplierData(supplierRec);

  const handoffSteps = buildHandoffSteps({
    channel: routing.channel,
    riskOutcome: riskOutcome.decision,
    material: materiality.material,
    supplierDataIssue: !supplierData.complete,
  });

  // Second contract check (after the full description) — surfaces transactable
  // contracts and frameworks/MSAs against the supplier.
  const secondContractCheck = runSecondContractCheck({ supplierId, category, now, contracts });

  const hasContract = routing.channel === 'framework-call-off' || (supplierRec?.activeContracts ?? 0) > 0;
  const contractType = determineContractType({
    channel: routing.channel,
    category,
    hasFrameworkOrContract: hasContract,
    // Scope/headroom signals (DET-08): a material demand on an existing
    // agreement needs a change; a transactable contract has capacity (SOW),
    // otherwise the agreement is amended to extend coverage.
    scopeChange: materiality.material ? 'material' : 'none',
    withinHeadroom: secondContractCheck.recommendation === 'transact',
  });

  const sourcingType = determineSourcingType({
    channel: routing.channel,
    category,
    hasExistingSupplierRelationship: incumbentRelationship,
  });

  // Approval-to-source gate — which pre-sourcing approvals are required before
  // the demand can move into sourcing. A transactable contract is an early exit
  // (transact, not source), so no gate applies.
  const approvalToSource = determineApprovalToSource({
    estimatedValue,
    material: materiality.material,
    inherentTier: inherentRisk.tier,
    earlyExit: secondContractCheck.recommendation === 'transact',
  });

  const validatorActive = validatorAgent?.status === 'active';
  const policyChecks = validatorActive
    ? generatePolicyChecks(estimatedValue, category, supplierId, suppliers)
    : [
        {
          label: 'Request Validator agent',
          passed: false,
          detail: validatorAgent
            ? `${validatorAgent.name} is currently ${validatorAgent.status}. Enable it in Admin → AI Agents to run policy checks.`
            : 'AI-002 Request Validator not configured. Enable it in Admin → AI Agents.',
        },
      ];

  const matchingRiskAssessments: MatchingRiskAssessmentSummary[] = matches.map((m) => ({
    id: m.id,
    title: m.title,
    riskLevel: m.riskLevel,
    category: m.category,
    validUntil: m.validUntil,
  }));

  if (validatorActive && matchingRiskAssessments.length > 0) {
    policyChecks.push({
      label: 'Risk assessment reuse',
      passed: true,
      detail: `${matchingRiskAssessments.length} existing risk assessment${matchingRiskAssessments.length > 1 ? 's' : ''} can be reused — no new SRA required at intake.`,
    });
  }

  // Supplier screening — a flagged supplier blocks the demand (refer back).
  const screening = evaluateScreening(supplierRec?.screeningStatus);

  // Signals that drive the conditional lifecycle steps (item 7+11). A risk
  // assessment is needed when none can be reused and the demand is
  // triage-worthy or high/critical inherent risk; vendor onboarding when there
  // is no supplier or its master data is incomplete.
  const triage = isTriageRequired({
    supplierSraStatus: supplierRec?.sraStatus,
    supplierRiskRating: supplierRec?.riskRating,
    supplierRegistered: !!supplierId,
    matchingReusableSraCount: matchingRiskAssessments.length,
    inferredDataSensitivity: dataSensitivity,
  });
  const riskAssessmentRequired =
    matchingRiskAssessments.length === 0 &&
    (triage.required || inherentRisk.tier === 'high' || inherentRisk.tier === 'critical');
  const supplierOnboardingRequired = !supplierId || !supplierData.complete;

  // Demand disposition — proceed / request-change / refer-back. Driven by the
  // completeness, policy and scope signals already computed.
  const referral = determineReferral({
    missingMandatory: !requestTitle?.trim() || estimatedValue <= 0,
    outOfScope: policyChecks.some((c) => !c.passed && /prohibit|permissib|out of scope|blocked/i.test(c.label)),
    supplierBlocked: screening.blocking,
    failedPolicyChecks: validatorActive ? policyChecks.filter((c) => !c.passed).length : 0,
    // No duplicate search exists yet. Passing `false` here states "not found",
    // which is only honest because `duplicateCheck` below stays null — nothing
    // downstream may read this as evidence a search ran.
    duplicateDetected: false,
  });

  return {
    buyingChannelResult: label,
    buyingChannelSlug: routing.channel,
    approvalChain: configuredChain?.id ?? valueBandedChain?.id,
    matchedRuleName: routing.matchedRule?.name,
    materiality,
    inherentRisk,
    operationalRisk,
    riskOutcome,
    contractType,
    sourcingType,
    secondContractCheck,
    approvalToSource,
    residualQuestions,
    referral,
    screening,
    handoffSteps,
    dataSensitivity,
    pCardEligible: pCard.eligible,
    pCardIneligibleReasons: pCard.ineligibleReasons,
    sraStatus: supplierRec
      ? `${supplierRec.name}: ${supplierRec.sraStatus}${supplierRec.sraExpiryDate ? ` (expires ${supplierRec.sraExpiryDate})` : ''}`
      : 'Will be initiated upon submission',
    supplierSraStatus: supplierRec?.sraStatus,
    supplierSraExpiryDate: supplierRec?.sraExpiryDate,
    supplierName: supplierRec?.name,
    policyChecks,
    duplicateCheck: null,
    matchingRiskAssessments,
    validatorAgentStatus: (validatorAgent?.status ?? 'missing') as IntakeDetermination['validatorAgentStatus'],
    validatorAgentName: validatorAgent?.name,
    riskAssessmentRequired,
    supplierOnboardingRequired,
    triageRequired: triage.required,
    triageReason: triage.reason,
  };
}
