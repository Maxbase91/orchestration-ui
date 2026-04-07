import { useEffect, useState, useCallback } from 'react';
import { Loader2, Info, ChevronDown, ChevronUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { ComplianceCheckResult } from './components/compliance-check-result';
import { AISuggestionCard } from '@/components/shared/ai-suggestion-card';
import { formatCurrency } from '@/lib/format';
import { suppliers } from '@/data/suppliers';
import { getFormTemplate } from '@/data/form-templates';
import { DynamicForm } from '@/components/shared/dynamic-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BuyingChannel } from '@/data/types';

interface ComplianceData {
  buyingChannelResult: string;
  sraStatus: string;
  policyChecks: { label: string; passed: boolean; detail: string }[];
  duplicateCheck: string | null;
}

interface StepComplianceProps {
  category: string;
  estimatedValue: number;
  supplierId: string;
  isUrgent: boolean;
  onUpdate: (data: ComplianceData) => void;
}

function determineBuyingChannel(category: string, value: number): { channel: BuyingChannel; label: string } {
  if (value < 25000) return { channel: 'catalogue', label: 'Catalogue / Direct PO' };
  if (category === 'consulting' || value > 100000) return { channel: 'procurement-led', label: 'Procurement-Led Sourcing' };
  if (category === 'contingent-labour') return { channel: 'framework-call-off', label: 'Framework Call-Off' };
  if (value <= 50000) return { channel: 'business-led', label: 'Business-Led' };
  return { channel: 'procurement-led', label: 'Procurement-Led Sourcing' };
}

function generatePolicyChecks(
  value: number,
  category: string,
  supplierId: string,
  _isUrgent: boolean
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
  isUrgent,
  onUpdate,
}: StepComplianceProps) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ComplianceData | null>(null);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      const { label } = determineBuyingChannel(category, estimatedValue);
      const supplier = suppliers.find((s) => s.id === supplierId);
      const policyChecks = generatePolicyChecks(estimatedValue, category, supplierId, isUrgent);

      const data: ComplianceData = {
        buyingChannelResult: label,
        sraStatus: supplier
          ? `${supplier.name}: ${supplier.sraStatus}${supplier.sraExpiryDate ? ` (expires ${supplier.sraExpiryDate})` : ''}`
          : 'Will be initiated upon submission',
        policyChecks,
        duplicateCheck: null,
      };

      setResult(data);
      onUpdate(data);
      setLoading(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, [category, estimatedValue, supplierId, isUrgent]); // eslint-disable-line react-hooks/exhaustive-deps

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
          </div>
        </div>
      </div>

      {/* SRA Status */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm font-medium text-gray-900">SRA Status</p>
        <p className="mt-1 text-sm text-gray-600">{result.sraStatus}</p>
      </div>

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

  const template = getFormTemplate('FORM-001');
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

// ── IT Security Assessment Section ──────────────────────────────────

function ITSecurityAssessmentSection() {
  const [collapsed, setCollapsed] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const template = getFormTemplate('FORM-006');
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
