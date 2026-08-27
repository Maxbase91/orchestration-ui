// Compliance tab on the request detail page: the intake-time policy checks
// (buying channel, risk-assessment status, policy gates) alongside the fuller
// compliance report produced after Validation. Either block may be absent.
import type { ProcurementRequest } from '@/data/types';
import { useComplianceReport } from '@/lib/db/hooks/use-compliance-reports';
import { useIntakeCompliance } from '@/lib/db/hooks/use-intake-compliance';
import { ComplianceReportCard } from '@/components/shared/compliance-report-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TabComplianceProps {
  request: ProcurementRequest;
}

export function TabCompliance({ request }: TabComplianceProps) {
  const { data: report } = useComplianceReport(request.id);
  const { data: intake } = useIntakeCompliance(request.id);

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

  const hasContent = report || intake || determination.length > 0;

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
              <Badge variant="outline" className={cn('text-xs', intake.sraCheck.status === 'pass' ? 'border-green-200 text-green-700' : intake.sraCheck.status === 'fail' ? 'border-red-200 text-red-700' : 'border-amber-200 text-amber-700')}>
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

      {report && <ComplianceReportCard report={report} />}
    </div>
  );
}
