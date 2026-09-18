import { useState } from 'react';
import { Sparkles, CheckCircle, XCircle, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ComplianceReport, ComplianceCheck } from '@/data/compliance-reports';
import { useAiAgent } from '@/lib/db/hooks/use-ai-agents';

interface ComplianceReportCardProps {
  report: ComplianceReport;
  defaultExpanded?: boolean;
}

const decisionStyles: Record<ComplianceReport['decision'], { label: string; className: string }> = {
  approved: { label: 'Approved', className: 'bg-ok-soft text-ok border-ok-line' },
  'needs-review': { label: 'Needs Review', className: 'bg-warn-soft text-warn border-warn-line' },
  rejected: { label: 'Rejected', className: 'bg-stop-soft text-stop border-stop-line' },
};

const statusIcons: Record<ComplianceCheck['status'], { icon: typeof CheckCircle; className: string }> = {
  pass: { icon: CheckCircle, className: 'text-ok' },
  fail: { icon: XCircle, className: 'text-stop' },
  warning: { icon: AlertTriangle, className: 'text-warn' },
  info: { icon: Info, className: 'text-accent-solid' },
};

const severityStyles: Record<ComplianceCheck['severity'], string> = {
  critical: 'bg-stop-soft text-stop',
  high: 'bg-warn-soft text-warn',
  medium: 'bg-idle-soft text-ink-2',
  low: 'bg-card-2 text-ink-3',
};

const CATEGORIES: ComplianceCheck['category'][] = ['Budget', 'Contract', 'Supplier Compliance', 'Policy', 'Risk', 'Value'];

export function ComplianceReportCard({ report, defaultExpanded = false }: ComplianceReportCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { data: agent } = useAiAgent('AI-006');

  if (agent && agent.status !== 'active') {
    return (
      <div className="rounded-md border-l-2 border-line bg-card-2 p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 shrink-0 text-ink-3" />
          <span className="text-sm font-semibold text-ink-2">PR Compliance Review</span>
          <span className="rounded-full border border-line bg-card px-2 py-0.5 text-xs text-ink-3">
            {agent.name} is {agent.status}
          </span>
        </div>
        <p className="mt-2 pl-6 text-sm text-ink-3">
          {agent.name} is currently {agent.status}. Enable it in Admin → AI Agents to regenerate
          the PR compliance report for this request.
        </p>
      </div>
    );
  }

  const decision = decisionStyles[report.decision];
  const passedCount = report.checks.filter((c) => c.status === 'pass').length;
  const totalCount = report.checks.length;

  const groupedChecks = CATEGORIES.reduce<Record<string, ComplianceCheck[]>>((acc, cat) => {
    const checks = report.checks.filter((c) => c.category === cat);
    if (checks.length > 0) acc[cat] = checks;
    return acc;
  }, {});

  return (
    <div className="rounded-md border-l-2 border-accent-solid bg-accent-soft/30 p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 shrink-0 text-accent-solid" />
          <span className="text-sm font-semibold text-ink">PR Compliance Review</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', decision.className)}>
            {decision.label}
          </span>
          <span className="text-xs font-medium text-ink-3">{report.confidence}%</span>
        </div>
      </div>

      {/* Agent info */}
      <p className="mt-1 pl-6 text-[11px] text-muted-foreground">
        Reviewed by {report.agentId} {report.agentName}
        {agent?.accuracy ? ` · accuracy ${agent.accuracy}%` : ''}
        {' · '}
        {new Date(report.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
      </p>

      {/* Summary */}
      <p className="mt-2 pl-6 text-sm text-ink-2">{report.summary}</p>

      {/* Toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="mt-3 ml-6 inline-flex items-center gap-1 text-xs font-medium text-accent-solid hover:text-accent-solid"
      >
        {expanded ? 'Hide details' : 'Show details'}
        {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>

      {expanded && (
        <div className="mt-3 ml-6 space-y-4">
          {/* Checks grouped by category */}
          {Object.entries(groupedChecks).map(([category, checks]) => (
            <div key={category}>
              <h4 className="text-xs font-semibold text-ink-3 uppercase tracking-wide mb-1.5">{category}</h4>
              <div className="space-y-1.5">
                {checks.map((check) => {
                  const iconConfig = statusIcons[check.status];
                  const StatusIcon = iconConfig.icon;
                  return (
                    <div key={check.id} className="flex items-start gap-2">
                      <StatusIcon className={cn('size-4 shrink-0 mt-0.5', iconConfig.className)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-ink">{check.check}</span>
                          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', severityStyles[check.severity])}>
                            {check.severity}
                          </span>
                        </div>
                        <p className="text-xs text-ink-2">{check.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Stats */}
          <div className="text-xs text-ink-3 pt-2 border-t border-accent-line">
            {passedCount}/{totalCount} checks passed
          </div>

          {/* Recommendation */}
          <div className="rounded-md bg-accent-soft border border-accent-line p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Info className="size-3.5 text-accent-solid" />
              <span className="text-xs font-semibold text-accent-solid">Recommendation</span>
            </div>
            <p className="text-xs text-accent-solid">{report.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}
