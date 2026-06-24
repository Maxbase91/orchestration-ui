import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Info, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Sparkles, Circle, MinusCircle, Clock, Recycle, Download } from 'lucide-react';
import { toast } from 'sonner';
import { ComplianceCheckResult } from './components/compliance-check-result';
import { AISuggestionCard } from '@/components/shared/ai-suggestion-card';
import { formatCurrency } from '@/lib/format';
import { useSourceData } from '@/lib/integrations';
import { isPreferredSupplier, competitiveSourcingCheck, preferredSupplierCheck } from '@/lib/procurement/supplier-preference';
import { determineMateriality, type MaterialityResult } from '@/lib/procurement/materiality';
import { determineInherentRisk, type InherentRiskResult } from '@/lib/procurement/risk-segmentation';
import { selectReuseOutcome, type ReuseEvaluation } from '@/lib/procurement/risk-reuse';
import { buildHandoffSteps, type HandoffStep } from '@/lib/procurement/handoff';
import { evaluateSupplierData } from '@/lib/procurement/supplier-data';
import { determineContractType, determineSourcingType, type ContractType, type SourcingType } from '@/lib/procurement/determination';
import { buildDeterminationExport } from '@/lib/procurement/determination-export';
import { runSecondContractCheck, type SecondContractCheckResult } from '@/lib/procurement/second-contract-check';
import { determineApprovalToSource, type ApprovalToSourceResult } from '@/lib/procurement/approval-to-source';
import { determineResidualQuestions, type ResidualQuestion } from '@/lib/procurement/residual-questions';
import { assessOperationalRisk, type OperationalRiskResult } from '@/lib/procurement/operational-risk-assessment';
import { determineReferral, type ReferralResult } from '@/lib/procurement/referral';
import { evaluateScreening, type ScreeningResult } from '@/lib/procurement/screening';
import type { Supplier, Contract, WorkflowTemplate, RoutingRule } from '@/data/types';
// Risk-reuse matching stays on its specialised query (reusable + completed +
// validity-window + supplier/contract); the generic ports do not model that yet.
import { useMatchingRiskAssessments } from '@/lib/db/hooks/use-risk-assessments';
import { useFormTemplate } from '@/lib/db/hooks/use-form-templates';
import { useRoutingRules } from '@/lib/db/hooks/use-routing-rules';
import { useAiAgent } from '@/lib/db/hooks/use-ai-agents';
import { useWorkflowTemplates } from '@/lib/db/hooks/use-workflow-templates';
import { resolveRouting, buyingChannelLabel } from '@/lib/routing/evaluate-routing-rules';
import { DynamicForm } from '@/components/shared/dynamic-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { SupplierRecommenderCard } from './components/supplier-recommender-card';
import type { RiskAssessment } from '@/data/types';

// Stable empty fallbacks defined at module level. Inline `= []` creates a
// new array reference on every render, which destabilises the useMemo dep
// array and causes an infinite update loop via onUpdate.
const EMPTY_SUPPLIERS: Supplier[] = [];
const EMPTY_CONTRACTS: Contract[] = [];
const EMPTY_MATCHES: RiskAssessment[] = [];
const EMPTY_RULES: RoutingRule[] = [];
const EMPTY_TEMPLATES: WorkflowTemplate[] = [];

interface MatchingRiskAssessmentSummary {
  id: string;
  title: string;
  riskLevel: RiskAssessment['riskLevel'];
  category: RiskAssessment['category'];
  validUntil: string;
}

interface ComplianceData {
  buyingChannelResult: string;
  matchedRuleName?: string;
  materiality?: MaterialityResult;
  inherentRisk?: InherentRiskResult;
  operationalRisk?: OperationalRiskResult;
  riskOutcome?: ReuseEvaluation;
  contractType?: { type: ContractType; reason: string };
  sourcingType?: { type: SourcingType; reason: string };
  secondContractCheck?: SecondContractCheckResult;
  approvalToSource?: ApprovalToSourceResult;
  residualQuestions?: ResidualQuestion[];
  referral?: ReferralResult;
  screening?: ScreeningResult;
  handoffSteps?: HandoffStep[];
  sraStatus: string;
  policyChecks: { label: string; passed: boolean; detail: string }[];
  duplicateCheck: string | null;
  matchingRiskAssessments: MatchingRiskAssessmentSummary[];
  validatorAgentStatus?: 'active' | 'draft' | 'disabled' | 'missing';
  validatorAgentName?: string;
  workflowTemplateId?: string;
}

interface StepComplianceProps {
  category: string;
  estimatedValue: number;
  supplierId: string;
  supplier?: string;
  isUrgent: boolean;
  serviceDescription?: {
    objective?: string;
    scope?: string;
    deliverables?: string;
    resources?: string;
    narrative?: string;
  } | null;
  workflowTemplateId?: string;
  requestTitle?: string;
  /** Which half of the split step to render: the risk assessment or the determination. */
  phase: 'risk' | 'determination';
  miniIrq: { privilegedAccess: boolean; criticalService: boolean };
  onMiniIrqChange: (m: { privilegedAccess: boolean; criticalService: boolean }) => void;
  onUpdate: (data: Partial<ComplianceData>) => void;
}

/**
 * Derive a data-sensitivity classification from the collected SOW so the
 * risk-triage form can arrive pre-filled. Keyword heuristic — intentionally
 * conservative: unknown sensitive-term = "high" rather than "low".
 */
function inferDataSensitivity(sow: StepComplianceProps['serviceDescription']): 'none' | 'low' | 'medium' | 'high' | 'critical' {
  const blob = [sow?.objective, sow?.scope, sow?.deliverables, sow?.resources, sow?.narrative]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (!blob) return 'medium';
  const critical = ['payment data', 'card data', 'pci', 'health data', 'medical records', 'classified', 'state secret'];
  const high = ['personal data', 'pii', 'gdpr', 'customer data', 'confidential', 'financial records', 'payroll', 'employee data', 'ip address'];
  const medium = ['internal', 'proprietary', 'commercial', 'contract terms', 'supplier data'];
  const low = ['public', 'marketing', 'brochure', 'website content'];
  if (critical.some((k) => blob.includes(k))) return 'critical';
  if (high.some((k) => blob.includes(k))) return 'high';
  if (medium.some((k) => blob.includes(k))) return 'medium';
  if (low.some((k) => blob.includes(k))) return 'low';
  return 'medium';
}

function mapSraStatus(status: string | undefined): string {
  switch (status) {
    case 'valid': return 'yes-valid';
    case 'expiring': return 'yes-expiring';
    case 'expired':
    case 'not-assessed':
      return 'no';
    default: return 'unknown';
  }
}

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


function generatePolicyChecks(
  value: number,
  category: string,
  supplierId: string,
  _isUrgent: boolean,
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

export function StepCompliance({
  category,
  estimatedValue,
  supplierId,
  supplier,
  isUrgent,
  serviceDescription,
  workflowTemplateId,
  requestTitle,
  phase,
  miniIrq,
  onMiniIrqChange,
  onUpdate,
}: StepComplianceProps) {
  const { data: suppliers = EMPTY_SUPPLIERS } = useSourceData<Supplier>('supplier');
  const { data: allContracts = EMPTY_CONTRACTS } = useSourceData<Contract>('contract');
  const { data: matches = EMPTY_MATCHES, isFetched: matchesFetched } = useMatchingRiskAssessments({ supplierId });
  const { data: routingRules = EMPTY_RULES } = useRoutingRules();
  const { data: validatorAgent } = useAiAgent('AI-002');
  const { data: workflowTemplates = EMPTY_TEMPLATES } = useWorkflowTemplates();

  // Mini-IRQ (delta only) — lifted to the parent so the answers captured on the
  // risk step still drive the determination step.

  // A fetch is pending if we have a supplierId and the matching-SRA
  // lookup hasn't resolved yet. Once resolved (success or error),
  // matchesFetched flips true. Without a supplierId the query is
  // disabled, so we treat it as resolved immediately.
  const loading = Boolean(supplierId) && !matchesFetched;

  // Compose the compliance result purely from inputs. useMemo keeps
  // the reference stable across re-renders so parent onUpdate doesn't
  // create a feedback loop.
  const result = useMemo<ComplianceData | null>(() => {
    if (loading) return null;
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
    // Stage-5 residual questions — only the deltas the SD leaves open and that
    // would change the determination; an empty list means nothing to ask.
    const residualQuestions = determineResidualQuestions({
      category,
      dataSensitivity,
      estimatedValue,
      supplierRiskRating: supplierRec?.riskRating,
    });
    // Preliminary operational risk assessment — a per-dimension operational view
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
      {
        supplierId,
        category,
        dataSensitivity,
        inherentTier: inherentRisk.tier,
        now: new Date().toISOString().slice(0, 10),
      },
      matches,
    );
    const routing = resolveRouting(routingRules, {
      category,
      value: estimatedValue,
      supplierId,
      priority: isUrgent ? 'urgent' : undefined,
      isUrgent,
      riskRating: inherentRisk.tier,
      material: materiality.material,
    });
    const label = buyingChannelLabel(routing.channel);
    const supplierData = evaluateSupplierData(supplierRec);
    const handoffSteps = buildHandoffSteps({
      channel: routing.channel,
      riskOutcome: riskOutcome.decision,
      material: materiality.material,
      supplierDataIssue: !supplierData.complete,
    });
    // Second contract check (after the full SD) — surfaces transactable
    // contracts and frameworks/MSAs against the supplier.
    const secondContractCheck = runSecondContractCheck({
      supplierId,
      category,
      now: new Date().toISOString().slice(0, 10),
      contracts: allContracts,
    });
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
      hasExistingSupplierRelationship: (supplierRec?.activeContracts ?? 0) > 0 || (supplierRec?.totalSpend12m ?? 0) > 0,
    });
    // Approval-to-source gate — which pre-sourcing approvals are required
    // before the demand can move into sourcing. A transactable contract is an
    // early exit (transact, not source), so no gate applies.
    const approvalToSource = determineApprovalToSource({
      estimatedValue,
      material: materiality.material,
      inherentTier: inherentRisk.tier,
      earlyExit: secondContractCheck.recommendation === 'transact',
    });

    const validatorActive = validatorAgent?.status === 'active';
    const policyChecks = validatorActive
      ? generatePolicyChecks(estimatedValue, category, supplierId, isUrgent, suppliers)
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

    // Supplier screening — surfaced on the determination; a flagged supplier
    // blocks the demand (refer back).
    const screening = evaluateScreening(supplierRec?.screeningStatus);

    // Demand disposition — proceed / request-change / refer-back. Driven by the
    // completeness, policy and scope signals the determination already computed.
    const referral = determineReferral({
      missingMandatory: !requestTitle?.trim() || estimatedValue <= 0,
      outOfScope: policyChecks.some((c) => !c.passed && /prohibit|permissib|out of scope|blocked/i.test(c.label)),
      supplierBlocked: screening.blocking,
      failedPolicyChecks: validatorActive ? policyChecks.filter((c) => !c.passed).length : 0,
      duplicateDetected: false,
    });

    return {
      buyingChannelResult: label,
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
      sraStatus: supplierRec
        ? `${supplierRec.name}: ${supplierRec.sraStatus}${supplierRec.sraExpiryDate ? ` (expires ${supplierRec.sraExpiryDate})` : ''}`
        : 'Will be initiated upon submission',
      policyChecks,
      duplicateCheck: null,
      matchingRiskAssessments,
      validatorAgentStatus: (validatorAgent?.status ?? 'missing') as ComplianceData['validatorAgentStatus'],
      validatorAgentName: validatorAgent?.name,
    };
  }, [loading, category, estimatedValue, supplierId, isUrgent, serviceDescription, miniIrq, suppliers, allContracts, matches, routingRules, validatorAgent]);

  // Push the composed result up to the parent whenever the data changes.
  // We intentionally exclude `onUpdate` from the deps: it's a new arrow
  // on every parent render, and including it would cause a setState
  // loop (parent re-renders → new onUpdate → effect fires → parent
  // re-renders …).
  useEffect(() => {
    if (result) onUpdate(result);
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  // Default workflow template derived from category whenever the user
  // hasn't picked one yet. Same onUpdate-exclusion reasoning applies.
  useEffect(() => {
    if (workflowTemplateId || workflowTemplates.length === 0) return;
    const byType = workflowTemplates.find((t) => t.type === category);
    const standard = workflowTemplates.find((t) => t.name?.toLowerCase().includes('standard'));
    const defaultId = byType?.id ?? standard?.id ?? workflowTemplates[0].id;
    onUpdate({ workflowTemplateId: defaultId } as Partial<ComplianceData>);
  }, [workflowTemplateId, workflowTemplates, category]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <Loader2 className="size-8 animate-spin text-blue-500" />
        <p className="mt-4 text-sm font-medium">Running compliance checks...</p>
        <p className="mt-1 text-xs text-gray-400">
          Checking buying channel, SRA, policy rules, and duplicate requests
        </p>
      </div>
    );
  }

  if (!result) return null;

  const allPassed = result.policyChecks.every((c) => c.passed);

  const handleExport = () => {
    const supplierName = suppliers.find((s) => s.id === supplierId)?.name ?? supplier;
    const { markdown, filename } = buildDeterminationExport({
      requestTitle,
      category,
      estimatedValue,
      supplierName,
      buyingChannel: result.buyingChannelResult,
      referral: result.referral,
      contractType: result.contractType,
      sourcingType: result.sourcingType,
      contractCoverage: result.secondContractCheck
        ? {
            recommendation: result.secondContractCheck.recommendation,
            reason: result.secondContractCheck.reason,
            candidates: result.secondContractCheck.candidates.map((c) => ({ title: c.title, kind: c.kind })),
          }
        : undefined,
      materiality: result.materiality,
      inherentRisk: result.inherentRisk,
      operationalRisk: result.operationalRisk,
      riskOutcome: result.riskOutcome
        ? { decision: result.riskOutcome.decision, reasons: result.riskOutcome.reasons }
        : undefined,
      approvalToSource: result.approvalToSource,
      handoffSteps: result.handoffSteps,
      policyChecks: result.policyChecks,
      generatedAt: new Date().toISOString().slice(0, 10),
    });
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Determination exported');
  };

  return (
    <div className="space-y-6">
      {phase === 'risk' && (<>
      {/* Mini-IRQ (delta only) — the two inherent-risk attributes that cannot be
          inferred from the service description. Answers refine the cascade live. */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Mini risk questionnaire</CardTitle>
          <p className="text-xs text-muted-foreground">
            We only ask what we couldn&apos;t derive from your service description.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {(result.residualQuestions?.length ?? 0) === 0 ? (
            <p className="text-sm text-gray-500">
              No further questions — your service description already covers what we need to assess.
            </p>
          ) : (
            result.residualQuestions!.map((q) => {
              const switchId = q.id === 'privileged-access' ? 'mini-irq-access' : 'mini-irq-critical';
              return (
                <div key={q.id} className="flex items-center justify-between gap-4">
                  <label htmlFor={switchId} className="text-sm text-gray-700">
                    {q.question}
                    <span className="block text-xs text-gray-400">Asked because: {q.reason}</span>
                  </label>
                  <Switch
                    id={switchId}
                    checked={miniIrq[q.field]}
                    onCheckedChange={(v) => onMiniIrqChange({ ...miniIrq, [q.field]: v })}
                  />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Inherent risk — echoed here so the mini-IRQ answers above show their
          effect on this step (the full read carries through to the determination). */}
      {result.inherentRisk && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-900">Inherent risk</p>
          <p className="mt-1 text-sm text-gray-700">
            <span className={`font-semibold ${
              result.inherentRisk.tier === 'critical' ? 'text-red-700'
                : result.inherentRisk.tier === 'high' ? 'text-amber-700'
                  : 'text-gray-900'
            }`}>{result.inherentRisk.tier}</span>
            <span className="text-xs text-gray-500"> · {result.inherentRisk.drivers.join('; ')}</span>
          </p>
          {result.riskOutcome && (
            <p className="mt-0.5 text-xs text-gray-500">
              Assessment outcome: <span className="font-medium text-gray-700">{result.riskOutcome.decision}</span> ({result.riskOutcome.reasons[0]})
            </p>
          )}
        </div>
      )}

      {/* Preliminary operational risk assessment — per-dimension operational view
          (continuity, data, concentration, regulatory, access). */}
      {result.operationalRisk && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-gray-900">Preliminary operational risk</p>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
              result.operationalRisk.overall === 'high' ? 'bg-red-100 text-red-700'
                : result.operationalRisk.overall === 'medium' ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-500'
            }`}>
              {result.operationalRisk.overall}
            </span>
          </div>
          <ul className="mt-3 space-y-1.5">
            {result.operationalRisk.dimensions.map((d) => (
              <li key={d.key} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-sm text-gray-700">{d.label}</span>
                  <span className="block text-xs text-gray-400">{d.reason}</span>
                </div>
                <span className={`shrink-0 text-xs font-medium ${
                  d.rating === 'high' ? 'text-red-600'
                    : d.rating === 'medium' ? 'text-amber-600'
                      : 'text-gray-400'
                }`}>
                  {d.rating}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      </>)}
      {phase === 'determination' && (<>
      {/* Determination header — the R1 endpoint is exportable. */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">Determination</p>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="size-3.5 mr-1.5" /> Export
        </Button>
      </div>

      {/* Demand disposition — proceed / request-change / refer-back. The
          headline routing decision: can this demand move to its next step? */}
      {result.referral && (
        <div className={`rounded-lg border p-3 ${
          result.referral.outcome === 'refer-back' ? 'border-red-200 bg-red-50/60'
            : result.referral.outcome === 'request-change' ? 'border-amber-200 bg-amber-50/60'
              : 'border-green-200 bg-green-50/60'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
              result.referral.outcome === 'refer-back' ? 'bg-red-100 text-red-700'
                : result.referral.outcome === 'request-change' ? 'bg-amber-100 text-amber-700'
                  : 'bg-green-100 text-green-700'
            }`}>
              {result.referral.outcome === 'refer-back' ? 'Refer back'
                : result.referral.outcome === 'request-change' ? 'Request change' : 'Proceed'}
            </span>
            <span className="text-xs text-gray-600">{result.referral.reason}</span>
          </div>
        </div>
      )}
      {/* Buying Channel Classification */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0 text-blue-500" />
          <div>
            <p className="text-sm font-medium text-gray-900">Buying Channel Classification</p>
            <p className="mt-1 text-sm text-gray-700">
              Based on value ({formatCurrency(estimatedValue)}), category ({category}), this is classified as:{' '}
              <span className="font-semibold text-blue-700">{result.buyingChannelResult}</span>
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              {result.matchedRuleName
                ? `Matched routing rule: ${result.matchedRuleName}`
                : 'No admin routing rule matched — using default fallback.'}
            </p>
            {result.materiality && (
              <p className="mt-1 text-sm text-gray-700">
                Materiality:{' '}
                <span className={result.materiality.material ? 'font-semibold text-amber-700' : 'font-medium text-gray-600'}>
                  {result.materiality.material
                    ? `Material — ${result.materiality.criticality} (regulatory flag raised)`
                    : 'Not material'}
                </span>
                {result.materiality.material && (
                  <span className="text-xs text-gray-500"> · {result.materiality.reasons.join('; ')}</span>
                )}
              </p>
            )}
            {result.contractType && result.sourcingType && (
              <p className="mt-1 text-sm text-gray-700">
                Contract type: <span className="font-semibold text-gray-900">{result.contractType.type}</span>
                <span className="text-xs text-gray-500"> ({result.contractType.reason})</span>
                {' · '}Sourcing: <span className="font-semibold text-gray-900">{result.sourcingType.type}</span>
                <span className="text-xs text-gray-500"> ({result.sourcingType.reason})</span>
              </p>
            )}
            {result.inherentRisk && (
              <p className="mt-1 text-sm text-gray-700">
                Inherent risk:{' '}
                <span className="font-semibold text-gray-900">{result.inherentRisk.tier}</span>
                <span className="text-xs text-gray-500"> · {result.inherentRisk.drivers.join('; ')}</span>
                {result.riskOutcome && (
                  <span className="text-xs text-gray-500">
                    {' '}· assessment: <span className="font-medium text-gray-700">{result.riskOutcome.decision}</span> ({result.riskOutcome.reasons[0]})
                  </span>
                )}
              </p>
            )}
            {result.screening && (
              <p className="mt-1 text-sm text-gray-700">
                Supplier screening:{' '}
                <span className={`font-semibold ${
                  result.screening.blocking ? 'text-red-700'
                    : result.screening.cleared ? 'text-green-700' : 'text-amber-700'
                }`}>{result.screening.status}</span>
                <span className="text-xs text-gray-500"> · {result.screening.message}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Approval to source — the pre-sourcing gate (DET-05): which
          approvals are required before the demand can move into sourcing. */}
      {result.approvalToSource && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-gray-900">Approval to source</p>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
              result.approvalToSource.tier === 'full' ? 'bg-amber-100 text-amber-700'
                : result.approvalToSource.tier === 'light' ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-500'
            }`}>
              {result.approvalToSource.tier === 'none' ? 'not required' : `${result.approvalToSource.tier} gate`}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">{result.approvalToSource.rationale}</p>
          {result.approvalToSource.gates.length > 0 && (
            <ul className="mt-3 space-y-2">
              {result.approvalToSource.gates.map((gate) => (
                <li key={gate.id} className="border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                  <p className="text-sm font-medium text-gray-800">{gate.label}</p>
                  <p className="text-xs text-gray-500">{gate.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Next steps — the structured handoff panel: each step, its system,
          status and deep-link. R1 routes (deep-links), it does not write. */}
      {result.handoffSteps && result.handoffSteps.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-900">Next steps</p>
          <ul className="mt-3 space-y-2">
            {result.handoffSteps.map((step) => (
              <li key={step.key} className="flex items-start justify-between gap-3 border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">{step.label}</p>
                  <p className="text-xs text-gray-500">{step.system} · {step.detail}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    step.status === 'required' ? 'bg-amber-100 text-amber-700'
                      : step.status === 'recommended' ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-500'
                  }`}>
                    {step.status}
                  </span>
                  {step.deepLink && (
                    <Link to={step.deepLink} className="text-xs font-medium text-blue-600 hover:underline">
                      Open
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Second contract check — transactable contracts vs frameworks/MSAs. */}
      {result.secondContractCheck && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-900">Contract coverage</p>
          <p className="mt-0.5 text-xs text-gray-500">
            Recommendation: <span className="font-medium text-gray-700">{result.secondContractCheck.recommendation}</span> — {result.secondContractCheck.reason}
          </p>
          {result.secondContractCheck.candidates.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {result.secondContractCheck.candidates.map((c) => (
                <li key={c.contractId} className="flex items-start justify-between gap-3 border-b border-gray-50 pb-1.5 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800">{c.title}</p>
                    <p className="text-xs text-gray-500">{c.reason}</p>
                  </div>
                  <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    c.kind === 'transactable' ? 'bg-green-100 text-green-700'
                      : c.kind === 'framework' ? 'bg-blue-100 text-blue-700'
                        : 'bg-amber-100 text-amber-700'
                  }`}>
                    {c.kind}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      </>)}
      {phase === 'risk' && (<>
      {/* SRA Status */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm font-medium text-gray-900">SRA Status</p>
        <p className="mt-1 text-sm text-gray-600">{result.sraStatus}</p>
      </div>

      {/* Matching Risk Assessments (reuse) */}
      {result.matchingRiskAssessments.length > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="flex items-start gap-2">
            <Recycle className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-900">
                {result.matchingRiskAssessments.length} existing risk assessment
                {result.matchingRiskAssessments.length > 1 ? 's' : ''} eligible for reuse
              </p>
              <p className="mt-0.5 text-xs text-emerald-800/80">
                These assessments are valid and cover the selected supplier. A new SRA is not required at intake.
              </p>
              <ul className="mt-2 space-y-1.5">
                {result.matchingRiskAssessments.map((ra) => (
                  <li
                    key={ra.id}
                    className="flex items-center justify-between gap-2 rounded-md bg-white/70 px-2.5 py-1.5 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">{ra.title}</p>
                      <p className="text-[11px] text-gray-500">
                        {ra.id} · {ra.category} · {ra.riskLevel} risk · valid until {ra.validUntil}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      </>)}
      {phase === 'determination' && (<>
      {/* Policy Checks */}
      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-sm font-medium text-gray-700">Policy Checks</p>
          {result.validatorAgentName && (
            <p className="text-[11px] text-gray-400">
              {result.validatorAgentStatus === 'active'
                ? `via ${result.validatorAgentName} (AI-002)`
                : `${result.validatorAgentName} is ${result.validatorAgentStatus}`}
            </p>
          )}
        </div>
        <div className="space-y-2">
          {result.policyChecks.map((check) => (
            <ComplianceCheckResult
              key={check.label}
              label={check.label}
              passed={check.passed}
              detail={check.detail}
            />
          ))}
        </div>
      </div>

      {/* Duplicate Check */}
      <AISuggestionCard
        title="Duplicate Check"
        confidence={92}
      >
        <p>{result.duplicateCheck ?? 'No similar requests found in the last 90 days.'}</p>
      </AISuggestionCard>

      {/* Summary */}
      {allPassed ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center text-sm font-medium text-green-700">
          All compliance checks passed. You may proceed to the next step.
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center text-sm font-medium text-amber-700">
          Some checks require attention. Review the warnings above before proceeding.
        </div>
      )}

      </>)}
      {phase === 'risk' && (<>
      {/* Risk Assessment Triage — gated on whether a triage is actually
          required. Pre-filled from the collected SOW when shown. */}
      {(() => {
        const selectedSupplier = suppliers.find((s) => s.id === supplierId);
        const sensitivity = inferDataSensitivity(serviceDescription ?? null);
        const gate = isTriageRequired({
          supplierSraStatus: selectedSupplier?.sraStatus,
          supplierRiskRating: selectedSupplier?.riskRating,
          supplierRegistered: !!supplierId,
          matchingReusableSraCount: result.matchingRiskAssessments.length,
          inferredDataSensitivity: sensitivity,
        });
        if (!gate.required) {
          return (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle className="size-4 text-green-600" />
                  Risk Assessment Not Required
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700">{gate.reason} — no new triage needed at intake.</p>
                {result.matchingRiskAssessments.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-gray-600">
                    {result.matchingRiskAssessments.map((ra) => (
                      <li key={ra.id}>
                        <span className="font-medium text-gray-800">{ra.title}</span>
                        {' · '}
                        {ra.id} · {ra.category} · {ra.riskLevel} risk · valid until {ra.validUntil}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-[11px] text-gray-400">
                  Data sensitivity inferred from SOW: <strong>{sensitivity}</strong>.
                </p>
              </CardContent>
            </Card>
          );
        }
        return (
          <RiskAssessmentTriageSection
            supplierRegistered={!!supplierId}
            supplierSraStatus={selectedSupplier?.sraStatus}
            inferredDataSensitivity={sensitivity}
            triageReason={gate.reason}
            reuseCount={result.matchingRiskAssessments.length}
          />
        );
      })()}

      {/* IT Security Assessment (software only) */}
      {category === 'software' && (
        <ITSecurityAssessmentSection />
      )}

      {/* Smart Assessment */}
      <SmartAssessmentSection
        supplier={supplier ?? ''}
        supplierId={supplierId}
        category={category}
        estimatedValue={estimatedValue}
      />

      </>)}
      {phase === 'determination' && (<>
      {/* AI-005 Supplier Recommender */}
      <SupplierRecommenderCard
        category={category}
        estimatedValue={estimatedValue}
        selectedSupplierId={supplierId}
      />

      {/* The workflow is PRE-DEFINED from the input (derived by category in the
          effect above) and attached silently — it is not user-selectable. */}
      </>)}
    </div>
  );
}

// ── Risk Assessment Triage Section ──────────────────────────────────

function RiskAssessmentTriageSection({
  supplierRegistered,
  supplierSraStatus,
  inferredDataSensitivity,
  triageReason,
  reuseCount,
}: {
  supplierRegistered: boolean;
  supplierSraStatus?: string;
  inferredDataSensitivity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  triageReason: string;
  reuseCount: number;
}) {
  // Everything here is DERIVED — the requester is never asked to state the
  // supplier's SRA status or the data sensitivity (they wouldn't know). We show
  // what the system determined, with the reason, and conclude whether a risk
  // assessment is due. The only user inputs are the mini-IRQ deltas above.
  const rows: { label: string; value: string; reason: string }[] = [
    {
      label: 'Data sensitivity',
      value: inferredDataSensitivity,
      reason: 'inferred from your service description',
    },
    {
      label: 'Risk assessment on file',
      value: supplierRegistered ? mapSraStatus(supplierSraStatus) : 'no supplier selected yet',
      reason: supplierRegistered
        ? "read from the supplier's record"
        : 'a supplier is selected later, during validation',
    },
    {
      label: 'Reusable assessment',
      value: reuseCount > 0 ? `${reuseCount} available` : 'none found',
      reason: reuseCount > 0
        ? 'a valid assessment matches this supplier + category'
        : 'no valid assessment covers this demand',
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Risk assessment</CardTitle>
        <p className="text-xs text-muted-foreground">
          Derived from your service description and the supplier — there&apos;s no questionnaire to fill in.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-sm text-gray-700">{r.label}</span>
                <span className="block text-xs text-gray-400">{r.reason}</span>
              </div>
              <span className="shrink-0 text-sm font-medium capitalize text-gray-900">{r.value}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-800">A risk assessment is required</p>
            <p className="mt-1 text-xs text-amber-700">
              {reuseCount > 0
                ? `A reusable assessment exists, but a fresh one is needed here because ${triageReason}.`
                : 'No assessment can be reused, so a risk assessment is carried out — it appears as a step in the workflow.'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Smart Assessment Section ──────────────────────────────────────────

function SmartAssessmentSection({
  supplier,
  supplierId,
  category,
  estimatedValue,
}: {
  supplier: string;
  supplierId: string;
  category: string;
  estimatedValue: number;
}) {
  const { data: suppliers = [] } = useSourceData<Supplier>('supplier');
  const { data: contracts = [] } = useSourceData<Contract>('contract');
  const assessment = useMemo(() => {
    // Vendor match
    const matchedSupplier = supplierId
      ? suppliers.find((s) => s.id === supplierId)
      : supplier
        ? suppliers.find((s) => s.name.toLowerCase().includes(supplier.toLowerCase()))
        : null;

    // Contract coverage
    const matchedContracts = matchedSupplier
      ? contracts.filter((c) => c.supplierId === matchedSupplier.id && (c.status === 'active' || c.status === 'expiring'))
      : [];
    const hasActiveContract = matchedContracts.some((c) => c.status === 'active');
    const hasExpiringContract = matchedContracts.some((c) => c.status === 'expiring');

    // Buying channel determines sourcing need
    const needsSourcing = estimatedValue >= 25000 && category !== 'contingent-labour' && !hasActiveContract;
    const needsContracting = !hasActiveContract;
    const needsVPApproval = estimatedValue > 100000;

    // Build steps
    const steps = [
      { name: 'Intake', status: 'completed' as const, days: 0, detail: 'Completed' },
      { name: 'Validation', status: 'current' as const, days: 2, detail: 'Buying channel classification + vendor check' },
      { name: 'Approval', status: 'future' as const, days: needsVPApproval ? 5 : 3, detail: needsVPApproval ? 'Budget Owner → Finance → VP Procurement' : 'Budget Owner → Finance' },
      { name: 'Sourcing', status: (needsSourcing ? 'future' : 'skipped') as 'future' | 'skipped', days: 10, detail: needsSourcing ? 'Procurement-Led Sourcing via SAP Ariba' : `Skipped — ${hasActiveContract ? 'framework agreement available' : 'below threshold'}` },
      { name: 'Contracting', status: (needsContracting ? 'future' : 'skipped') as 'future' | 'skipped', days: 15, detail: needsContracting ? 'Contract required — via Sirion CLM' : `Skipped — existing contract (${matchedContracts[0]?.title ?? 'active'})` },
      { name: 'Purchase Order', status: 'future' as const, days: 2, detail: 'PO creation in SAP S/4HANA' },
      { name: 'Receipt & Payment', status: 'future' as const, days: 5, detail: 'Goods receipt + invoice matching + payment' },
    ];

    const totalDays = steps.filter((s) => s.status !== 'skipped').reduce((sum, s) => sum + s.days, 0);

    return { matchedSupplier, matchedContracts, hasActiveContract, hasExpiringContract, steps, totalDays };
  }, [supplier, supplierId, category, estimatedValue, suppliers, contracts]);

  // Vendor onboarding — derived from the supplier's onboardingStatus (data),
  // surfaced so a new/unonboarded supplier is flagged before engagement.
  const onboarding = (() => {
    const s = assessment.matchedSupplier;
    if (!s) return { tone: 'amber' as const, message: 'Vendor onboarding — a new supplier must be onboarded before a PO can be raised.' };
    if (s.onboardingStatus === 'completed') return { tone: 'green' as const, message: `Onboarding complete — ${s.name} is ready to transact.` };
    if (s.onboardingStatus === 'in-progress') return { tone: 'amber' as const, message: 'Onboarding in progress — complete before engagement.' };
    return { tone: 'red' as const, message: `Onboarding required — ${s.name} is not yet onboarded.` };
  })();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="size-4 text-[#2D5F8A]" />
          Smart Assessment — Estimated Processing Path
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Vendor Match */}
        {(supplier || supplierId) && (
          <div className={`flex items-start gap-2 rounded-lg border p-3 ${assessment.matchedSupplier ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
            {assessment.matchedSupplier ? (
              <CheckCircle className="size-4 text-green-600 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="size-4 text-amber-600 mt-0.5 shrink-0" />
            )}
            <div>
              <p className={`text-sm font-medium ${assessment.matchedSupplier ? 'text-green-800' : 'text-amber-800'}`}>
                {assessment.matchedSupplier
                  ? `Existing vendor — ${assessment.matchedSupplier.name}, ${assessment.matchedSupplier.country}, Risk: ${assessment.matchedSupplier.riskRating}, ${assessment.matchedSupplier.activeContracts} active contracts`
                  : 'New vendor — supplier onboarding will be required'}
              </p>
            </div>
          </div>
        )}

        {/* Contract Coverage */}
        {assessment.matchedSupplier && (
          <div className={`flex items-start gap-2 rounded-lg border p-3 ${assessment.hasActiveContract ? 'border-green-200 bg-green-50' : assessment.hasExpiringContract ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}`}>
            {assessment.hasActiveContract ? (
              <CheckCircle className="size-4 text-green-600 mt-0.5 shrink-0" />
            ) : assessment.hasExpiringContract ? (
              <AlertTriangle className="size-4 text-amber-600 mt-0.5 shrink-0" />
            ) : (
              <MinusCircle className="size-4 text-red-600 mt-0.5 shrink-0" />
            )}
            <div>
              <p className={`text-sm font-medium ${assessment.hasActiveContract ? 'text-green-800' : assessment.hasExpiringContract ? 'text-amber-800' : 'text-red-800'}`}>
                {assessment.hasActiveContract
                  ? `Active contract — ${assessment.matchedContracts[0]?.title}, valid until ${assessment.matchedContracts[0]?.endDate}, ${assessment.matchedContracts[0]?.utilisationPercentage}% utilised`
                  : assessment.hasExpiringContract
                    ? `Contract expiring — ${assessment.matchedContracts[0]?.title}, renewal recommended`
                    : 'No existing contract — contracting step required'}
              </p>
            </div>
          </div>
        )}

        {/* SRA Status */}
        {assessment.matchedSupplier && (
          <div className={`flex items-start gap-2 rounded-lg border p-3 ${assessment.matchedSupplier.sraStatus === 'valid' ? 'border-green-200 bg-green-50' : assessment.matchedSupplier.sraStatus === 'expiring' ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}`}>
            {assessment.matchedSupplier.sraStatus === 'valid' ? (
              <CheckCircle className="size-4 text-green-600 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="size-4 text-amber-600 mt-0.5 shrink-0" />
            )}
            <p className={`text-sm font-medium ${assessment.matchedSupplier.sraStatus === 'valid' ? 'text-green-800' : 'text-amber-800'}`}>
              {assessment.matchedSupplier.sraStatus === 'valid'
                ? `SRA valid until ${assessment.matchedSupplier.sraExpiryDate}`
                : assessment.matchedSupplier.sraStatus === 'expiring'
                  ? `SRA expiring on ${assessment.matchedSupplier.sraExpiryDate} — renewal recommended`
                  : 'SRA assessment required before engagement'}
            </p>
          </div>
        )}

        {/* Vendor onboarding (always shown — a new supplier needs onboarding) */}
        <div className={`flex items-start gap-2 rounded-lg border p-3 ${
          onboarding.tone === 'green' ? 'border-green-200 bg-green-50'
            : onboarding.tone === 'amber' ? 'border-amber-200 bg-amber-50'
              : 'border-red-200 bg-red-50'
        }`}>
          {onboarding.tone === 'green' ? (
            <CheckCircle className="size-4 text-green-600 mt-0.5 shrink-0" />
          ) : onboarding.tone === 'amber' ? (
            <AlertTriangle className="size-4 text-amber-600 mt-0.5 shrink-0" />
          ) : (
            <MinusCircle className="size-4 text-red-600 mt-0.5 shrink-0" />
          )}
          <p className={`text-sm font-medium ${
            onboarding.tone === 'green' ? 'text-green-800'
              : onboarding.tone === 'amber' ? 'text-amber-800' : 'text-red-800'
          }`}>{onboarding.message}</p>
        </div>

        {/* Estimated Journey */}
        <div className="space-y-2 pt-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Estimated Processing Steps</p>
          <div className="space-y-1">
            {assessment.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3 py-1.5">
                <div className="mt-0.5 shrink-0">
                  {step.status === 'completed' && <CheckCircle className="size-4 text-green-500" />}
                  {step.status === 'current' && <Circle className="size-4 text-blue-500 fill-blue-500" />}
                  {step.status === 'future' && <Circle className="size-4 text-gray-300" />}
                  {step.status === 'skipped' && <MinusCircle className="size-4 text-gray-300" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${step.status === 'skipped' ? 'text-gray-400 line-through' : step.status === 'completed' ? 'text-green-700' : step.status === 'current' ? 'text-blue-700' : 'text-gray-700'}`}>
                      {step.name}
                    </span>
                    {step.status === 'future' && step.days > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                        <Clock className="size-3" />~{step.days}d
                      </span>
                    )}
                    {step.status === 'skipped' && (
                      <span className="text-[10px] text-gray-400 italic">skipped</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <Clock className="size-4 text-[#2D5F8A]" />
            <span className="text-sm font-semibold text-gray-900">
              Estimated total: ~{assessment.totalDays} business days
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── IT Security Assessment Section ──────────────────────────────────

function ITSecurityAssessmentSection() {
  const [collapsed, setCollapsed] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { data: template } = useFormTemplate('FORM-006');
  if (!template) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-between text-left"
        >
          <CardTitle className="text-sm">IT Security Assessment</CardTitle>
          {collapsed ? (
            <ChevronDown className="size-4 text-gray-400" />
          ) : (
            <ChevronUp className="size-4 text-gray-400" />
          )}
        </button>
        <p className="text-xs text-muted-foreground">
          Required for software and SaaS procurement to ensure IT security compliance.
        </p>
      </CardHeader>
      {!collapsed && (
        <CardContent>
          {!submitted ? (
            <DynamicForm
              template={template}
              onSubmit={() => setSubmitted(true)}
            />
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
              <CheckCircle className="mt-0.5 size-4 shrink-0 text-green-600" />
              <p className="text-sm font-medium text-green-800">
                IT Security Assessment submitted.
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
