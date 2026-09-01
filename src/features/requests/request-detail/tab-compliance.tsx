// Compliance tab on the request detail page — the single home for every
// risk/compliance/policy signal about this request: the intake-time policy
// checks (buying channel, SRA, duplicate check, reused risk assessments, risk
// flags), the fuller compliance report produced after Validation, the
// front-door determination, and the linked supplier's own risk assessment.
// Any of these blocks may be absent depending on how far the request has
// progressed. This used to be split across this tab and a second copy
// embedded per-stage in the Workflow tab (ComplianceStageSection) — removed,
// so compliance content lives in exactly one place.
import { Link } from 'react-router-dom';
import type { ProcurementRequest } from '@/data/types';
import { useComplianceReport } from '@/lib/db/hooks/use-compliance-reports';
import { useIntakeCompliance } from '@/lib/db/hooks/use-intake-compliance';
import { useRiskAssessmentLookup, useRiskAssessments } from '@/lib/db/hooks/use-risk-assessments';
import { useSuppliers, useSupplierLookup } from '@/lib/db/hooks/use-suppliers';
import { ComplianceReportCard } from '@/components/shared/compliance-report-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ShieldQuestion,
  Info,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  Search,
  Flag,
  Recycle,
  Building2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

interface TabComplianceProps {
  request: ProcurementRequest;
}

const sraIcons = {
  valid: ShieldCheck,
  expiring: ShieldAlert,
  expired: ShieldX,
  'not-assessed': ShieldQuestion,
};

const sraColors = {
  valid: 'text-green-600',
  expiring: 'text-amber-600',
  expired: 'text-red-600',
  'not-assessed': 'text-gray-400',
};

function effectiveSraStatus(status: keyof typeof sraIcons, expiryDate?: string): keyof typeof sraIcons {
  if (expiryDate && status !== 'not-assessed') {
    const expiry = new Date(`${expiryDate}T23:59:59Z`).getTime();
    if (Number.isFinite(expiry) && expiry < Date.now()) return 'expired';
  }
  return status;
}

export function TabCompliance({ request }: TabComplianceProps) {
  const { data: report } = useComplianceReport(request.id);
  const { data: intake } = useIntakeCompliance(request.id);
  useRiskAssessments();
  const lookupRiskAssessment = useRiskAssessmentLookup();
  useSuppliers();
  const lookupSupplier = useSupplierLookup();
  const supplier = request.supplierId ? lookupSupplier(request.supplierId) : undefined;
  const supplierSraStatus = supplier
    ? effectiveSraStatus(supplier.sraStatus, supplier.sraExpiryDate)
    : undefined;

  // The determination now lives on the request itself, so there is something to
  // show even before the intake record or the post-validation report exist.
  const determination: { label: string; value: string }[] = [
    { label: 'Inherent risk', value: request.inherentRiskTier ?? '' },
    { label: 'Materiality', value: request.materialityTier ?? '' },
    { label: 'Screening', value: request.screeningOutcome ?? '' },
    { label: 'Demand disposition', value: request.referralDisposition ?? '' },
    { label: 'Sourcing type', value: request.sourcingType ?? '' },
    {
      label: 'Risk assessment',
      value: request.riskAssessmentRequired ? 'Required' : '',
    },
  ].filter((d) => d.value);

  const hasContent = report || intake || determination.length > 0 || supplier;

  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
        <ShieldCheck className="size-10 opacity-30" />
        <p className="text-sm">No compliance record for this request.</p>
        <p className="text-xs">
          Requests submitted through the intake wizard carry their determination from
          submission; this one predates that.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {determination.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="size-4 text-blue-500" />
              Front-door determination
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
              {determination.map((d) => (
                <div key={d.label}>
                  <dt className="text-xs text-muted-foreground">{d.label}</dt>
                  <dd className="font-medium capitalize text-gray-900">{d.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      {intake && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Info className="size-4 text-blue-500" />
              Intake Compliance Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Buying Channel</span>
              <span className="font-medium">{intake.buyingChannel.label}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">SRA Status</span>
              {/* `not-run` renders grey rather than amber: it is a check that
                  has not happened, not one that raised a concern. */}
              <Badge variant="outline" className={cn('text-xs',
                intake.sraCheck.status === 'pass' ? 'border-green-200 text-green-700'
                  : intake.sraCheck.status === 'fail' ? 'border-red-200 text-red-700'
                    : intake.sraCheck.status === 'not-run' ? 'border-gray-200 text-gray-600'
                      : 'border-amber-200 text-amber-700')}>
                {intake.sraCheck.status}
              </Badge>
            </div>
            <div className="mt-2 space-y-1.5">
              {intake.policyChecks.map((c) => (
                <div key={c.label} className="flex items-start gap-2 text-sm">
                  <span className={cn('mt-0.5 size-2 rounded-full shrink-0', c.passed ? 'bg-green-500' : 'bg-red-500')} />
                  <div className="flex-1 min-w-0">
                    <p className={cn('font-medium', c.passed ? 'text-gray-900' : 'text-red-700')}>{c.label}</p>
                    {c.detail && <p className="text-xs text-muted-foreground">{c.detail}</p>}
                  </div>
                  <Badge variant="outline" className={cn('text-xs shrink-0', c.passed ? 'border-green-200 text-green-700' : 'border-red-200 text-red-700')}>
                    {c.passed ? 'Pass' : 'Fail'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {intake && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Search className="size-4 text-blue-600" />
              <CardTitle className="text-sm">Duplicate Check</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Three states, not two: a search that ran and found nothing is a
                green "No duplicates"; one that never ran must not borrow that
                badge, because a reviewer treats it as a cleared check. */}
            <div className="flex items-center gap-2">
              {intake.duplicateCheck.performed === false ? (
                <HelpCircle className="size-4 text-gray-400" />
              ) : intake.duplicateCheck.found ? (
                <AlertTriangle className="size-4 text-amber-500" />
              ) : (
                <CheckCircle className="size-4 text-green-600" />
              )}
              <Badge
                variant="outline"
                className={
                  intake.duplicateCheck.performed === false
                    ? 'bg-gray-100 text-gray-600 border-gray-200'
                    : intake.duplicateCheck.found
                      ? 'bg-amber-100 text-amber-700 border-amber-200'
                      : 'bg-green-100 text-green-700 border-green-200'
                }
              >
                {intake.duplicateCheck.performed === false
                  ? 'Not checked'
                  : intake.duplicateCheck.found ? 'Potential overlap found' : 'No duplicates'}
              </Badge>
            </div>
            <p className="text-xs text-gray-600">{intake.duplicateCheck.detail}</p>
          </CardContent>
        </Card>
      )}

      {intake?.matchingRiskAssessmentIds && intake.matchingRiskAssessmentIds.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Recycle className="size-4 text-emerald-600" />
              <CardTitle className="text-sm">Reused Risk Assessments</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {intake.matchingRiskAssessmentIds.map((raId) => {
                const ra = lookupRiskAssessment(raId);
                if (!ra) return null;
                return (
                  <div
                    key={raId}
                    className="flex items-start justify-between gap-2 rounded-md border border-emerald-100 bg-emerald-50/40 px-3 py-1.5"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{ra.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {ra.id} · {ra.category} · {ra.riskLevel} risk · valid until {ra.validUntil}
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 shrink-0">
                      Reused
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {intake && intake.riskFlags.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Flag className="size-4 text-red-500" />
              <CardTitle className="text-sm">Risk Flags</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {intake.riskFlags.map((flag, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-amber-500" />
                  <p className="text-xs text-gray-700">{flag}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {supplier && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Building2 className="size-4 text-blue-500" />
                Supplier Risk Assessment
              </CardTitle>
              <Link
                to={`/suppliers/${supplier.id}`}
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                View full profile
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Overall Risk Rating</span>
                <StatusBadge status={supplier.riskRating} size="sm" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">SRA Status</span>
                <div className="flex items-center gap-1.5">
                  {(() => {
                    const status = supplierSraStatus ?? 'not-assessed';
                    const Icon = sraIcons[status];
                    const color = sraColors[status];
                    return (
                      <>
                        <Icon className={`size-4 ${color}`} />
                        <span className={`text-sm font-medium ${color}`}>
                          {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>
              {supplier.sraExpiryDate && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">SRA Expiry</span>
                  <span className="text-sm">{formatDate(supplier.sraExpiryDate)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Screening Status</span>
                <StatusBadge status={supplier.screeningStatus} size="sm" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Performance Score</span>
                <span className="text-sm font-medium">{supplier.performanceScore}/100</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {report && <ComplianceReportCard report={report} />}
    </div>
  );
}
