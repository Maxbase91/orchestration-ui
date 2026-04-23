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
import { resolveRouting, buyingChannelLabel } from '@/lib/routing/evaluate-routing-rules';
import { DynamicForm } from '@/components/shared/dynamic-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
}

interface StepComplianceProps {
  category: string;
  estimatedValue: number;
  supplierId: string;
  supplier?: string;
  isUrgent: boolean;
  onUpdate: (data: ComplianceData) => void;
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
  onUpdate,
}: StepComplianceProps) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ComplianceData | null>(null);
  const { data: suppliers = [] } = useSuppliers();
  const { data: matches = [], isFetched: matchesFetched } = useMatchingRiskAssessments({ supplierId });
  const { data: routingRules = [] } = useRoutingRules();

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
      const policyChecks = generatePolicyChecks(estimatedValue, category, supplierId, isUrgent, suppliers);

      const matchingRiskAssessments: MatchingRiskAssessmentSummary[] = matches.map((m) => ({
        id: m.id,
        title: m.title,
        riskLevel: m.riskLevel,
        category: m.category,
        validUntil: m.validUntil,
      }));

      if (matchingRiskAssessments.length > 0) {
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
      };

      setResult(data);
      onUpdate(data);
      setLoading(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, [category, estimatedValue, supplierId, isUrgent, suppliers, matches, matchesFetched, routingRules]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <p className="mb-3 text-sm font-medium text-gray-700">Policy Checks</p>
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

      {/* Risk Assessment Triage Form */}
      <RiskAssessmentTriageSection
        category={category}
        supplierName={suppliers.find((s) => s.id === supplierId)?.name ?? ''}
        estimatedValue={estimatedValue}
      />

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
    </div>
  );
}

// ── Risk Assessment Triage Section ──────────────────────────────────

function RiskAssessmentTriageSection({
  category,
  supplierName,
  estimatedValue,
}: {
  category: string;
  supplierName: string;
  estimatedValue: number;
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
          Complete this short questionnaire to determine risk assessment requirements.
        </p>
      </CardHeader>
      {!collapsed && (
        <CardContent className="space-y-4">
          {!submitted ? (
            <DynamicForm
              template={template}
              prePopulateContext={prePopulateContext}
              onSubmit={handleTriageSubmit}
            />
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
