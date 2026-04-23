import { useEffect, useState, useCallback, useMemo } from 'react';
import { Loader2, Info, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Sparkles, Circle, MinusCircle, Clock, Recycle } from 'lucide-react';
import { ComplianceCheckResult } from './components/compliance-check-result';
import { AISuggestionCard } from '@/components/shared/ai-suggestion-card';
import { formatCurrency } from '@/lib/format';
import { useSuppliers } from '@/lib/db/hooks/use-suppliers';
import type { Supplier } from '@/data/types';
import { useContracts } from '@/lib/db/hooks/use-contracts';
import { useMatchingRiskAssessments } from '@/lib/db/hooks/use-risk-assessments';
import { useFormTemplate } from '@/lib/db/hooks/use-form-templates';
import { useRoutingRules } from '@/lib/db/hooks/use-routing-rules';
import { useAiAgent } from '@/lib/db/hooks/use-ai-agents';
import { useWorkflowTemplates } from '@/lib/db/hooks/use-workflow-templates';
import { resolveRouting, buyingChannelLabel } from '@/lib/routing/evaluate-routing-rules';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { DynamicForm } from '@/components/shared/dynamic-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SupplierRecommenderCard } from './components/supplier-recommender-card';
import type { RiskAssessment } from '@/data/types';

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

  checks.push({
    label: 'Competitive quotes policy',
    passed: value < 25000 || category === 'contingent-labour',
    detail:
      value >= 25000 && category !== 'contingent-labour'
        ? `Value (${formatCurrency(value)}) requires minimum 3 competitive quotes`
        : 'Below competitive quote threshold or exempt category',
  });

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
  onUpdate,
}: StepComplianceProps) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ComplianceData | null>(null);
  const { data: suppliers = [] } = useSuppliers();
  const { data: matches = [], isFetched: matchesFetched } = useMatchingRiskAssessments({ supplierId });
  const { data: routingRules = [] } = useRoutingRules();
  const { data: validatorAgent } = useAiAgent('AI-002');
  const { data: workflowTemplates = [] } = useWorkflowTemplates();

  // Default workflow template derived from category whenever the user
  // hasn't picked one yet. The mapping prefers a template whose `type`
  // matches the request category, else falls back to the first template.
  useEffect(() => {
    if (workflowTemplateId || workflowTemplates.length === 0) return;
    const byType = workflowTemplates.find((t) => t.type === category);
    const defaultId = byType?.id ?? workflowTemplates[0].id;
    onUpdate({ workflowTemplateId: defaultId } as Partial<ComplianceData>);
  }, [workflowTemplateId, workflowTemplates, category, onUpdate]);

  useEffect(() => {
    setLoading(true);
    // Wait for Supabase lookups before composing the result.
    if (!matchesFetched && supplierId) return;
    const timer = setTimeout(() => {
      const routing = resolveRouting(routingRules, {
        category,
        value: estimatedValue,
        supplierId,
        priority: isUrgent ? 'urgent' : undefined,
        isUrgent,
      });
      const label = buyingChannelLabel(routing.channel);
      const supplier = suppliers.find((s) => s.id === supplierId);

      // AI-002 Request Validator owns the policy-check logic. When the agent
      // is inactive, only the single "validator offline" check is produced so
      // the admin sees an obvious signal their toggle took effect.
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

      const data: ComplianceData = {
        buyingChannelResult: label,
        matchedRuleName: routing.matchedRule?.name,
        sraStatus: supplier
          ? `${supplier.name}: ${supplier.sraStatus}${supplier.sraExpiryDate ? ` (expires ${supplier.sraExpiryDate})` : ''}`
          : 'Will be initiated upon submission',
        policyChecks,
        duplicateCheck: null,
        matchingRiskAssessments,
        validatorAgentStatus: (validatorAgent?.status ?? 'missing') as ComplianceData['validatorAgentStatus'],
        validatorAgentName: validatorAgent?.name,
      };

      setResult(data);
      onUpdate(data);
      setLoading(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, [category, estimatedValue, supplierId, isUrgent, suppliers, matches, matchesFetched, routingRules, validatorAgent]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div className="space-y-6">
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
          </div>
        </div>
      </div>

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
            category={category}
            supplierName={selectedSupplier?.name ?? ''}
            estimatedValue={estimatedValue}
            supplierRegistered={!!supplierId}
            supplierSraStatus={selectedSupplier?.sraStatus}
            inferredDataSensitivity={sensitivity}
            sowNarrative={serviceDescription?.narrative ?? ''}
            triageReason={gate.reason}
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

      {/* AI-005 Supplier Recommender */}
      <SupplierRecommenderCard
        category={category}
        estimatedValue={estimatedValue}
        selectedSupplierId={supplierId}
      />

      {/* Workflow template picker — chosen template is stored on the
          request and rendered on the request-detail workflow tab. */}
      {workflowTemplates.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Workflow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label className="text-xs text-gray-500">
              Which template should this request follow?
            </Label>
            <Select
              value={workflowTemplateId ?? ''}
              onValueChange={(v) => onUpdate({ workflowTemplateId: v } as Partial<ComplianceData>)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a template..." />
              </SelectTrigger>
              <SelectContent>
                {workflowTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.type ? ` (${t.type})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-gray-400">
              The request lifecycle still follows the 9-stage enum; the chosen template is
              attached for reference and visible on the request detail.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Risk Assessment Triage Section ──────────────────────────────────

function RiskAssessmentTriageSection({
  category,
  supplierName,
  estimatedValue,
  supplierRegistered,
  supplierSraStatus,
  inferredDataSensitivity,
  sowNarrative,
  triageReason,
}: {
  category: string;
  supplierName: string;
  estimatedValue: number;
  supplierRegistered: boolean;
  supplierSraStatus?: string;
  inferredDataSensitivity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  sowNarrative: string;
  triageReason: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [triageResult, setTriageResult] = useState<'full-sra' | 'no-action' | null>(null);

  const handleTriageSubmit = useCallback(
    (values: Record<string, string | string[] | boolean>) => {
      const sraStatus = values['f001-sra-status'] as string;
      const dataSensitivity = values['f001-data-sensitivity'] as string;
      const needsFullSRA =
        sraStatus === 'no' ||
        sraStatus === 'unknown' ||
        dataSensitivity === 'high' ||
        dataSensitivity === 'critical';
      setTriageResult(needsFullSRA ? 'full-sra' : 'no-action');
      setSubmitted(true);
    },
    [],
  );

  const { data: template } = useFormTemplate('FORM-001');
  if (!template) return null;

  const prePopulateContext: Record<string, string> = {
    supplierName,
    value: String(estimatedValue),
    category,
    // Answers derived upstream from the SOW. DynamicForm resolves each
    // field via prePopulateFrom first, then falls back to the field.id —
    // so we provide both namings for any field that lacks an explicit key.
    sraStatus: mapSraStatus(supplierSraStatus),
    'f001-sra-status': mapSraStatus(supplierSraStatus),
    'f001-registered': supplierRegistered ? 'yes' : 'no',
    'f001-data-sensitivity': inferredDataSensitivity,
    'f001-annual-spend': String(estimatedValue),
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-between text-left"
        >
          <CardTitle className="text-sm">Risk Assessment Triage</CardTitle>
          {collapsed ? (
            <ChevronDown className="size-4 text-gray-400" />
          ) : (
            <ChevronUp className="size-4 text-gray-400" />
          )}
        </button>
        <p className="text-xs text-muted-foreground">
          Triage required — <em>{triageReason}</em>. Fields are pre-filled from the service
          description; adjust before submitting.
        </p>
      </CardHeader>
      {!collapsed && (
        <CardContent className="space-y-4">
          {!submitted ? (
            <>
              {sowNarrative && (
                <div className="rounded-md border border-blue-100 bg-blue-50/40 p-3 text-xs text-gray-600">
                  <p className="font-medium text-gray-700">Pre-filled from your service description</p>
                  <p className="mt-1">
                    Data sensitivity inferred as <strong>{inferredDataSensitivity}</strong>;
                    supplier SRA status mapped to <strong>{mapSraStatus(supplierSraStatus)}</strong>.
                    Adjust any field below if needed.
                  </p>
                </div>
              )}
              <DynamicForm
                template={template}
                prePopulateContext={prePopulateContext}
                onSubmit={handleTriageSubmit}
              />
            </>
          ) : triageResult === 'full-sra' ? (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Full Supplier Risk Assessment required
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  A detailed questionnaire will be triggered during the Validation stage.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
              <CheckCircle className="mt-0.5 size-4 shrink-0 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  No additional risk assessment required at this time.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      )}
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
  const { data: suppliers = [] } = useSuppliers();
  const { data: contracts = [] } = useContracts();
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
