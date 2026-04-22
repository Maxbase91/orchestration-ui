import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/page-header';
import { KPICard } from '@/components/shared/kpi-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { DemandPipelineChart } from '@/features/dashboard/components/demand-pipeline-chart';
import { useRequests } from '@/lib/db/hooks/use-requests';
import { formatCurrency, formatDate } from '@/lib/format';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RequestStatus } from '@/data/types';

const PIPELINE_STAGES: { key: RequestStatus; label: string }[] = [
  { key: 'intake', label: 'Intake' },
  { key: 'validation', label: 'Validation' },
  { key: 'approval', label: 'Approval' },
  { key: 'sourcing', label: 'Sourcing' },
  { key: 'contracting', label: 'Contracting' },
  { key: 'po', label: 'Purchase Order' },
];

export function DemandPipelinePage() {
  const navigate = useNavigate();
  const { data: requests = [] } = useRequests();
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set(['intake', 'approval']));

  const pipelineRequests = useMemo(() => {
    return requests.filter((r) => PIPELINE_STAGES.some((s) => s.key === r.status));
  }, [requests]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof requests> = {};
    for (const stage of PIPELINE_STAGES) {
      groups[stage.key] = pipelineRequests.filter((r) => r.status === stage.key);
    }
    return groups;
  }, [pipelineRequests]);

  const totalValue = pipelineRequests.reduce((sum, r) => sum + r.value, 0);
  const avgDays = pipelineRequests.length > 0
    ? Math.round(pipelineRequests.reduce((sum, r) => sum + r.daysInStage, 0) / pipelineRequests.length)
    : 0;
  const completedCount = requests.filter((r) => r.status === 'completed').length;
  const totalStarted = requests.filter((r) => r.status !== 'draft' && r.status !== 'cancelled').length;
  const conversionRate = totalStarted > 0 ? Math.round((completedCount / totalStarted) * 100) : 0;

  const toggleStage = (key: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Demand Pipeline" subtitle="Track procurement requests through the pipeline" />

      <div className="grid gap-4 sm:grid-cols-3">
        <KPICard label="Total Demand Value" value={totalValue} format="currency" />
        <KPICard label="Avg Days in Pipeline" value={`${avgDays} days`} />
        <KPICard label="Conversion Rate" value={conversionRate} format="percentage" />
      </div>

      <div className="rounded-md border bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Pipeline Distribution</h3>
        <DemandPipelineChart />
      </div>

      <div className="space-y-2">
        {PIPELINE_STAGES.map((stage) => {
          const stageRequests = grouped[stage.key] ?? [];
          const isExpanded = expandedStages.has(stage.key);
          return (
            <div key={stage.key} className="rounded-md border bg-white shadow-sm">
              <button
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                onClick={() => toggleStage(stage.key)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="size-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="size-4 text-gray-500" />
                  )}
                  <span className="text-sm font-semibold text-gray-900">{stage.label}</span>
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                    {stageRequests.length}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(stageRequests.reduce((s, r) => s + r.value, 0))}
                </span>
              </button>
              {isExpanded && stageRequests.length > 0 && (
                <div className="border-t">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="px-4 py-2 text-left font-medium text-muted-foreground">ID</th>
                        <th className="px-4 py-2 text-left font-medium text-muted-foreground">Title</th>
                        <th className="px-4 py-2 text-left font-medium text-muted-foreground">Priority</th>
                        <th className="px-4 py-2 text-right font-medium text-muted-foreground">Value</th>
                        <th className="px-4 py-2 text-center font-medium text-muted-foreground">Days in Stage</th>
                        <th className="px-4 py-2 text-left font-medium text-muted-foreground">Delivery</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {stageRequests.map((r) => (
                        <tr
                          key={r.id}
                          className={cn('cursor-pointer hover:bg-gray-50', r.isOverdue && 'bg-red-50')}
                          onClick={() => navigate(`/requests/${r.id}`)}
                        >
                          <td className="px-4 py-2 font-mono text-xs">{r.id}</td>
                          <td className="px-4 py-2 font-medium max-w-[250px] truncate">{r.title}</td>
                          <td className="px-4 py-2">
                            <StatusBadge status={r.priority} size="sm" />
                          </td>
                          <td className="px-4 py-2 text-right">{formatCurrency(r.value)}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={cn('font-semibold', r.daysInStage > 5 ? 'text-red-600' : 'text-gray-700')}>
                              {r.daysInStage}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-xs">{formatDate(r.deliveryDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {isExpanded && stageRequests.length === 0 && (
                <div className="border-t px-4 py-4 text-center text-xs text-muted-foreground">
                  No requests in this stage
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
