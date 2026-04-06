import { useMemo } from 'react';
import { requests } from '@/data/requests';
import { getLatestKPI, kpiData } from '@/data/kpi-data';
import { formatCurrency } from '@/lib/format';
import { KPICard } from '@/components/shared/kpi-card';
import { AISuggestionCard } from '@/components/shared/ai-suggestion-card';
import { DemandPipelineChart } from './components/demand-pipeline-chart';
import { WorkloadChart } from './components/workload-chart';
import { AttentionRequiredList } from './components/attention-required-list';

const activeStatuses = new Set([
  'intake', 'validation', 'approval', 'sourcing', 'contracting', 'po', 'receipt', 'invoice', 'referred-back',
]);

export function ProcurementManagerDashboard() {
  const latestKPI = getLatestKPI();

  const { openDemandCount, openDemandValue, activeSourcingCount, avgCycleTime, complianceRate } = useMemo(() => {
    const active = requests.filter((r) => activeStatuses.has(r.status));
    const sourcing = requests.filter((r) => r.status === 'sourcing');
    const totalValue = active.reduce((sum, r) => sum + r.value, 0);

    return {
      openDemandCount: active.length,
      openDemandValue: totalValue,
      activeSourcingCount: sourcing.length,
      avgCycleTime: latestKPI.avgCycleTime,
      complianceRate: latestKPI.complianceRate,
    };
  }, [latestKPI]);

  const sparklines = useMemo(() => ({
    openDemand: kpiData.map((k) => k.openDemand),
    sourcing: kpiData.map((k) => k.activeSourcing),
    cycleTime: kpiData.map((k) => k.avgCycleTime),
    compliance: kpiData.map((k) => k.complianceRate),
  }), []);

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          label="Open Demand"
          value={`${openDemandCount} (${formatCurrency(openDemandValue)})`}
          trend={{ direction: 'up', percentage: 12 }}
          sparklineData={sparklines.openDemand}
        />
        <KPICard
          label="Active Sourcing Events"
          value={activeSourcingCount}
          trend={{ direction: 'up', percentage: 8 }}
          sparklineData={sparklines.sourcing}
        />
        <KPICard
          label="Avg Cycle Time"
          value={`${avgCycleTime}d`}
          trend={{ direction: 'down', percentage: 7 }}
          sparklineData={sparklines.cycleTime}
        />
        <KPICard
          label="Compliance Rate"
          value={complianceRate}
          format="percentage"
          trend={{ direction: 'up', percentage: 3 }}
          sparklineData={sparklines.compliance}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-card rounded-md shadow-[0_1px_4px_rgba(0,0,0,0.08)] p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Demand Pipeline</h2>
          <DemandPipelineChart />
        </div>
        <div className="bg-card rounded-md shadow-[0_1px_4px_rgba(0,0,0,0.08)] p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Team Workload</h2>
          <WorkloadChart />
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Attention Required */}
        <div className="col-span-2 bg-card rounded-md shadow-[0_1px_4px_rgba(0,0,0,0.08)] p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Attention Required</h2>
          <AttentionRequiredList />
        </div>

        {/* AI Insights */}
        <div>
          <AISuggestionCard
            title="Strategic Insights"
            confidence={91}
            showExplanation
            explanation="Based on analysis of current request pipeline, supplier TPRA dates, and historical demand patterns."
          >
            <ul className="space-y-2 list-none">
              <li className="flex items-start gap-2">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-amber-400" />
                <span>3 requests have been in approval for &gt;10 days.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-red-400" />
                <span>2 suppliers have expiring TPRAs this month.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-blue-400" />
                <span>Demand for IT consulting is 40% above forecast.</span>
              </li>
            </ul>
          </AISuggestionCard>
        </div>
      </div>
    </div>
  );
}
