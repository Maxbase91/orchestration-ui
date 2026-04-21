import type { ProcurementRequest } from '@/data/types';
import { getIntakeCompliance } from '@/data/request-compliance';
import { getComplianceReport } from '@/data/compliance-reports';
import { riskAssessments } from '@/data/risk-assessments';
import { ComplianceReportCard } from '@/components/shared/compliance-report-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/format';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  GitBranch,
  Search,
  Flag,
  Info,
  Recycle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TabComplianceProps {
  request: ProcurementRequest;
}

const sraStatusConfig: Record<string, { label: string; icon: typeof CheckCircle; className: string; badgeClass: string }> = {
  pass: { label: 'Pass', icon: CheckCircle, className: 'text-green-600', badgeClass: 'bg-green-100 text-green-700 border-green-200' },
  warning: { label: 'Warning', icon: AlertTriangle, className: 'text-amber-500', badgeClass: 'bg-amber-100 text-amber-700 border-amber-200' },
  fail: { label: 'Fail', icon: XCircle, className: 'text-red-500', badgeClass: 'bg-red-100 text-red-700 border-red-200' },
  'not-applicable': { label: 'N/A', icon: Info, className: 'text-gray-400', badgeClass: 'bg-gray-100 text-gray-600 border-gray-200' },
};

export function TabCompliance({ request }: TabComplianceProps) {
  const intake = getIntakeCompliance(request.id);
  const complianceReport = getComplianceReport(request.id);

  if (!intake) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2">
        <ShieldCheck className="size-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No compliance data available for this request.</p>
      </div>
    );
  }

  const passedCount = intake.policyChecks.filter((c) => c.passed).length;
  const totalCount = intake.policyChecks.length;
  const allPassed = passedCount === totalCount;

  const sraConfig = sraStatusConfig[intake.sraCheck.status];
  const SraIcon = sraConfig.icon;

  return (
    <div className="space-y-6">
      {/* Buying Channel Classification */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <GitBranch className="size-4 text-blue-600" />
            <CardTitle className="text-base">Buying Channel Classification</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-lg font-bold text-gray-900">{intake.buyingChannel.label}</p>
            <p className="text-sm text-muted-foreground mt-1">{intake.buyingChannel.reasoning}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Determined at {formatDate(intake.determinedAt)}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SRA Status */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-blue-600" />
              <CardTitle className="text-base">SRA Status</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <SraIcon className={cn('size-5', sraConfig.className)} />
              <Badge variant="outline" className={sraConfig.badgeClass}>
                {sraConfig.label}
              </Badge>
            </div>
            <p className="text-sm text-gray-700">{intake.sraCheck.detail}</p>
          </CardContent>
        </Card>

        {/* Duplicate Check */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Search className="size-4 text-blue-600" />
              <CardTitle className="text-base">Duplicate Check</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              {intake.duplicateCheck.found ? (
                <AlertTriangle className="size-5 text-amber-500" />
              ) : (
                <CheckCircle className="size-5 text-green-600" />
              )}
              <Badge
                variant="outline"
                className={
                  intake.duplicateCheck.found
                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                    : 'bg-green-100 text-green-700 border-green-200'
                }
              >
                {intake.duplicateCheck.found ? 'Potential overlap found' : 'No duplicates'}
              </Badge>
            </div>
            <p className="text-sm text-gray-700">{intake.duplicateCheck.detail}</p>
          </CardContent>
        </Card>
      </div>

      {/* Policy Checks */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-blue-600" />
              <CardTitle className="text-base">Policy Checks</CardTitle>
            </div>
            <Badge
              variant="outline"
              className={
                allPassed
                  ? 'bg-green-100 text-green-700 border-green-200'
                  : 'bg-amber-100 text-amber-700 border-amber-200'
              }
            >
              {passedCount} of {totalCount} passed
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {intake.policyChecks.map((check, index) => (
              <div
                key={index}
                className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0"
              >
                {check.passed ? (
                  <CheckCircle className="size-4 shrink-0 mt-0.5 text-green-600" />
                ) : (
                  <XCircle className="size-4 shrink-0 mt-0.5 text-red-500" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{check.label}</p>
                  <p className="text-xs text-gray-600">{check.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Reused Risk Assessments */}
      {intake.matchingRiskAssessmentIds && intake.matchingRiskAssessmentIds.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Recycle className="size-4 text-emerald-600" />
              <CardTitle className="text-base">Reused Risk Assessments</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {intake.matchingRiskAssessmentIds.map((raId) => {
                const ra = riskAssessments.find((r) => r.id === raId);
                if (!ra) return null;
                return (
                  <div
                    key={raId}
                    className="flex items-start justify-between gap-3 rounded-md border border-emerald-100 bg-emerald-50/40 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{ra.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {ra.id} · {ra.category} · {ra.riskLevel} risk · valid until {ra.validUntil}
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                      Reused
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Risk Flags */}
      {intake.riskFlags.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Flag className="size-4 text-red-500" />
              <CardTitle className="text-base">Risk Flags</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {intake.riskFlags.map((flag, index) => (
                <div key={index} className="flex items-start gap-2">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-500" />
                  <p className="text-sm text-gray-700">{flag}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* PR Compliance Report (if exists) */}
      {complianceReport && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">PR Compliance Report</h3>
          <ComplianceReportCard report={complianceReport} />
        </div>
      )}
    </div>
  );
}
