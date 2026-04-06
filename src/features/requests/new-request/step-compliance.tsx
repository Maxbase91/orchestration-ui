import { useEffect, useState } from 'react';
import { Loader2, Info } from 'lucide-react';
import { ComplianceCheckResult } from './components/compliance-check-result';
import { AISuggestionCard } from '@/components/shared/ai-suggestion-card';
import { formatCurrency } from '@/lib/format';
import { suppliers } from '@/data/suppliers';
import type { BuyingChannel } from '@/data/types';

interface ComplianceData {
  deubaResult: string;
  tpraStatus: string;
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
  if (category === 'consulting' || value > 100000) return { channel: 'gp-led', label: 'GP-Led Procurement' };
  if (category === 'contingent-labour') return { channel: 'framework-call-off', label: 'Framework Call-Off' };
  if (value <= 50000) return { channel: 'business-led', label: 'Business-Led' };
  return { channel: 'gp-led', label: 'GP-Led Procurement' };
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
    label: 'TPRA assessment valid',
    passed: supplier ? supplier.tpraStatus === 'valid' : false,
    detail: supplier
      ? supplier.tpraStatus === 'valid'
        ? `TPRA valid until ${supplier.tpraExpiryDate}`
        : supplier.tpraStatus === 'expiring'
          ? `TPRA expiring on ${supplier.tpraExpiryDate}; renewal recommended`
          : 'TPRA assessment required before engagement'
      : 'Supplier not selected; TPRA status unknown',
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
        deubaResult: label,
        tpraStatus: supplier
          ? `${supplier.name}: ${supplier.tpraStatus}${supplier.tpraExpiryDate ? ` (expires ${supplier.tpraExpiryDate})` : ''}`
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
          Checking DEUBA, TPRA, policy rules, and duplicate requests
        </p>
      </div>
    );
  }

  if (!result) return null;

  const allPassed = result.policyChecks.every((c) => c.passed);

  return (
    <div className="space-y-6">
      {/* DEUBA Determination */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0 text-blue-500" />
          <div>
            <p className="text-sm font-medium text-gray-900">DEUBA Determination</p>
            <p className="mt-1 text-sm text-gray-700">
              Based on value ({formatCurrency(estimatedValue)}), category ({category}), this is classified as:{' '}
              <span className="font-semibold text-blue-700">{result.deubaResult}</span>
            </p>
          </div>
        </div>
      </div>

      {/* TPRA Status */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm font-medium text-gray-900">TPRA Status</p>
        <p className="mt-1 text-sm text-gray-600">{result.tpraStatus}</p>
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
    </div>
  );
}
