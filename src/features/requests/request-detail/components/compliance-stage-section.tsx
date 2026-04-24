import type { ProcurementRequest } from '@/data/types';
import { useIntakeCompliance } from '@/lib/db/hooks/use-intake-compliance';
import { useComplianceReport } from '@/lib/db/hooks/use-compliance-reports';
import { useRiskAssessmentLookup, useRiskAssessments } from '@/lib/db/hooks/use-risk-assessments';
import { ComplianceReportCard } from '@/components/shared/compliance-report-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

/**
 * Renders compliance-related context next to the stage that owns it:
 *   - intake       → buying channel classification
 *   - validation   → SRA status, duplicate check, policy checks,
 *                    reused risk assessments, risk flags
 *   - approval     → PR compliance report
 *
 * When no compliance data is available for this request, nothing is
 * rendered (previously the Compliance tab showed an "empty" placeholder
 * which read as a dead end).
 */
interface ComplianceStageSectionProps {
  stage: string;
  request: ProcurementRequest;
}

const sraStatusConfig: Record<string, { label: string; icon: typeof CheckCircle; className: string; badgeClass: string }> = {
  pass:             { label: 'Pass',     icon: CheckCircle,    className: 'text-green-600', badgeClass: 'bg-green-100 text-green-700 border-green-200' },
  warning:          { label: 'Warning',  icon: AlertTriangle,  className: 'text-amber-500', badgeClass: 'bg-amber-100 text-amber-700 border-amber-200' },
  fail:             { label: 'Fail',     icon: XCircle,        className: 'text-red-500',   badgeClass: 'bg-red-100 text-red-700 border-red-200' },
  'not-applicable': { label: 'N/A',      icon: Info,           className: 'text-gray-400',  badgeClass: 'bg-gray-100 text-gray-600 border-gray-200' },
};

export function ComplianceStageSection({ stage, request }: ComplianceStageSectionProps) {
  useRiskAssessments();
  const lookupRiskAssessment = useRiskAssessmentLookup();
  const { data: intake } = useIntakeCompliance(request.id);
  const { data: complianceReport } = useComplianceReport(request.id);

  // Nothing to render if we have no data at all.
  const nothingToRender =
    !intake && !(stage === 'approval' && complianceReport);
  if (nothingToRender) return null;

  return (
    <div className="mt-3 space-y-3">
      {stage === 'intake' && intake && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <GitBranch className="size-4 text-blue-600" />
              <CardTitle className="text-sm">Buying Channel Classification</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm font-semibold text-gray-900">{intake.buyingChannel.label}</p>
            <p className="text-xs text-muted-foreground">{intake.buyingChannel.reasoning}</p>
          </CardContent>
        </Card>
      )}

      {stage === 'validation' && intake && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* SRA Status */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-blue-600" />
                  <CardTitle className="text-sm">SRA Status</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {(() => {
                  const cfg = sraStatusConfig[intake.sraCheck.status];
                  const SraIcon = cfg.icon;
                  return (
                    <div className="flex items-center gap-2">
                      <SraIcon className={cn('size-4', cfg.className)} />
                      <Badge variant="outline" className={cfg.badgeClass}>{cfg.label}</Badge>
                    </div>
                  );
                })()}
                <p className="text-xs text-gray-600">{intake.sraCheck.detail}</p>
              </CardContent>
            </Card>

            {/* Duplicate Check */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Search className="size-4 text-blue-600" />
                  <CardTitle className="text-sm">Duplicate Check</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  {intake.duplicateCheck.found ? (
                    <AlertTriangle className="size-4 text-amber-500" />
                  ) : (
                    <CheckCircle className="size-4 text-green-600" />
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
                <p className="text-xs text-gray-600">{intake.duplicateCheck.detail}</p>
              </CardContent>
            </Card>
          </div>

          {/* Policy Checks */}
          {intake.policyChecks.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-blue-600" />
                    <CardTitle className="text-sm">Policy Checks</CardTitle>
                  </div>
                  {(() => {
                    const passed = intake.policyChecks.filter((c) => c.passed).length;
                    const total = intake.policyChecks.length;
                    return (
                      <Badge
                        variant="outline"
                        className={
                          passed === total
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : 'bg-amber-100 text-amber-700 border-amber-200'
                        }
                      >
                        {passed} of {total} passed
                      </Badge>
                    );
                  })()}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {intake.policyChecks.map((check, i) => (
                    <div key={i} className="flex items-start gap-2 py-1 border-b border-gray-100 last:border-0">
                      {check.passed ? (
                        <CheckCircle className="size-3.5 shrink-0 mt-0.5 text-green-600" />
                      ) : (
                        <XCircle className="size-3.5 shrink-0 mt-0.5 text-red-500" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-900">{check.label}</p>
                        <p className="text-[11px] text-gray-600">{check.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reused Risk Assessments */}
          {intake.matchingRiskAssessmentIds && intake.matchingRiskAssessmentIds.length > 0 && (
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

          {/* Risk Flags */}
          {intake.riskFlags.length > 0 && (
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
        </>
      )}

      {stage === 'approval' && complianceReport && (
        <ComplianceReportCard report={complianceReport} />
      )}
    </div>
  );
}
