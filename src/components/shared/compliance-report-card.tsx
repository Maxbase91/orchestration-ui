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
  approved: { label: 'Approved', className: 'bg-green-100 text-green-700 border-green-200' },
  'needs-review': { label: 'Needs Review', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700 border-red-200' },
};

const statusIcons: Record<ComplianceCheck['status'], { icon: typeof CheckCircle; className: string }> = {
  pass: { icon: CheckCircle, className: 'text-green-500' },
  fail: { icon: XCircle, className: 'text-red-500' },
  warning: { icon: AlertTriangle, className: 'text-amber-500' },
  info: { icon: Info, className: 'text-blue-500' },
};

const severityStyles: Record<ComplianceCheck['severity'], string> = {
  critical: 'bg-red-50 text-red-600',
  high: 'bg-amber-50 text-amber-600',
  medium: 'bg-gray-100 text-gray-600',
  low: 'bg-gray-50 text-gray-500',
};

const CATEGORIES: ComplianceCheck['category'][] = ['Budget', 'Contract', 'Supplier Compliance', 'Policy', 'Risk', 'Value'];

export function ComplianceReportCard({ report, defaultExpanded = false }: ComplianceReportCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { data: agent } = useAiAgent('AI-006');

  if (agent && agent.status !== 'active') {
    return (
      <div className="rounded-md border-l-2 border-gray-300 bg-gray-50 p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 shrink-0 text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">PR Compliance Review</span>
          <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-500">
            {agent.name} is {agent.status}
          </span>
        </div>
        <p className="mt-2 pl-6 text-sm text-gray-500">
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
    <div className="rounded-md border-l-2 border-blue-400 bg-blue-50/30 p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 shrink-0 text-blue-500" />
          <span className="text-sm font-semibold text-gray-900">PR Compliance Review</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', decision.className)}>
            {decision.label}
          </span>
          <span className="text-xs font-medium text-gray-500">{report.confidence}%</span>
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
      <p className="mt-2 pl-6 text-sm text-gray-700">{report.summary}</p>

      {/* Toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="mt-3 ml-6 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
      >
        {expanded ? 'Hide details' : 'Show details'}
        {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>

      {expanded && (
        <div className="mt-3 ml-6 space-y-4">
          {/* Checks grouped by category */}
          {Object.entries(groupedChecks).map(([category, checks]) => (
            <div key={category}>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{category}</h4>
              <div className="space-y-1.5">
                {checks.map((check) => {
                  const iconConfig = statusIcons[check.status];
                  const StatusIcon = iconConfig.icon;
                  return (
                    <div key={check.id} className="flex items-start gap-2">
                      <StatusIcon className={cn('size-4 shrink-0 mt-0.5', iconConfig.className)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800">{check.check}</span>
                          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', severityStyles[check.severity])}>
                            {check.severity}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">{check.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Stats */}
          <div className="text-xs text-gray-500 pt-2 border-t border-blue-100">
            {passedCount}/{totalCount} checks passed
          </div>

          {/* Recommendation */}
          <div className="rounded-md bg-blue-50 border border-blue-100 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Info className="size-3.5 text-blue-500" />
              <span className="text-xs font-semibold text-blue-700">Recommendation</span>
            </div>
            <p className="text-xs text-blue-800">{report.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}
