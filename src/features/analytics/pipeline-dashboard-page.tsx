import { useMemo } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { BarChartWidget } from '@/components/charts/bar-chart-widget';
import { LineChartWidget } from '@/components/charts/line-chart-widget';
import { useRequests } from '@/lib/db/hooks/use-requests';
import { useLivePipelineKpis } from './use-live-analytics';

const FUNNEL_STAGES = [
  { key: 'intake', label: 'Intake', statuses: ['intake', 'draft'] },
  { key: 'approval', label: 'Approval', statuses: ['validation', 'approval'] },
  { key: 'sourcing', label: 'Sourcing', statuses: ['sourcing'] },
  { key: 'contract', label: 'Contract', statuses: ['contracting'] },
  { key: 'po', label: 'PO / Delivery', statuses: ['po', 'receipt', 'invoice', 'payment'] },
] as const;

const STAGE_COLORS = ['#1B2A4A', '#2D5F8A', '#D4782F', '#2E7D4F', '#718096'];

export function PipelineDashboardPage() {
  const { data: requests = [] } = useRequests();
  const pipeline = useLivePipelineKpis();
  const funnelData = useMemo(() => {
    const activeRequests = requests.filter((r) => r.status !== 'completed' && r.status !== 'cancelled');
    return FUNNEL_STAGES.map((stage) => ({
      label: stage.label,
      count: activeRequests.filter((r) =>
        (stage.statuses as readonly string[]).includes(r.status),
      ).length,
    }));
  }, [requests]);

  const totalFunnel = useMemo(
    () => funnelData.reduce((sum, d) => sum + d.count, 0),
    [funnelData],
  );

  const maxFunnelCount = useMemo(
    () => Math.max(...funnelData.map((d) => d.count), 1),
    [funnelData],
  );

  const cycleTimeByStage = useMemo(
    () => [
      { name: 'Intake', value: 3 },
      { name: 'Validation', value: 4 },
      { name: 'Approval', value: 5 },
      { name: 'Sourcing', value: 8 },
      { name: 'Contracting', value: 6 },
      { name: 'PO', value: 3 },
    ],
    [],
  );

  const throughputData = useMemo(() => {
    const now = new Date();
    const n = pipeline.throughputSeries.length;
    // pipeline.throughputSeries[0] = oldest month; [n-1] = current month.
    return pipeline.throughputSeries.map((value, i) => {
      const monthsAgo = n - 1 - i;
      const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
      return {
        name: String(d.getMonth() + 1).padStart(2, '0'),
        value,
      };
    });
  }, [pipeline.throughputSeries]);

  // Ageing brackets per request
  const ageingData = useMemo(() => {
    const active = requests.filter(
      (r) => r.status !== 'completed' && r.status !== 'cancelled',
    );
    const brackets = [
      { name: '0-5 days', min: 0, max: 5, count: 0 },
      { name: '5-10 days', min: 5, max: 10, count: 0 },
      { name: '10-20 days', min: 10, max: 20, count: 0 },
      { name: '20+ days', min: 20, max: Infinity, count: 0 },
    ];
    for (const r of active) {
      const bracket = brackets.find(
        (b) => r.daysInStage >= b.min && r.daysInStage < b.max,
      );
      if (bracket) bracket.count++;
    }
    return brackets.map((b) => ({ name: b.name, value: b.count }));
  }, [requests]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline & Cycle Time"
        subtitle="Request funnel, throughput, and ageing analysis"
      />

      {/* Funnel Visualization */}
      <div className="rounded-md bg-white p-6 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
        <h3 className="mb-6 text-sm font-semibold text-gray-900">Request Funnel</h3>
        <div className="space-y-3">
          {funnelData.map((stage, i) => {
            const widthPct = Math.max((stage.count / maxFunnelCount) * 100, 8);
            const nextCount = funnelData[i + 1]?.count;
            const conversionRate =
              nextCount !== undefined && stage.count > 0
                ? Math.round((nextCount / stage.count) * 100)
                : null;

            return (
              <div key={stage.label}>
                <div className="flex items-center gap-4">
                  <span className="w-28 shrink-0 text-sm font-medium text-gray-700">
                    {stage.label}
                  </span>
                  <div className="flex-1">
                    <div
                      className="flex h-9 items-center rounded px-3"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: STAGE_COLORS[i],
                        minWidth: 60,
                      }}
                    >
                      <span className="text-sm font-semibold text-white">{stage.count}</span>
                    </div>
                  </div>
                  {conversionRate !== null && (
                    <span className="w-16 shrink-0 text-right text-xs text-gray-500">
                      {conversionRate}% &darr;
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-gray-500">
          Total active requests in funnel: {totalFunnel}
        </p>
      </div>

      {/* Cycle Time Distribution + Throughput */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-md bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">
            Cycle Time Distribution (Avg Days per Stage)
          </h3>
          <BarChartWidget
            data={cycleTimeByStage}
            dataKeys={[{ key: 'value', color: '#2D5F8A', label: 'Avg Days' }]}
            height={300}
          />
        </div>
        <div className="rounded-md bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Throughput (Completed per Month)</h3>
          <LineChartWidget
            data={throughputData}
            dataKeys={[{ key: 'value', color: '#2E7D4F', label: 'Requests Completed' }]}
            height={300}
          />
        </div>
      </div>

      {/* Ageing Analysis */}
      <div className="rounded-md bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">Ageing Analysis</h3>
        <BarChartWidget
          data={ageingData}
          dataKeys={[{ key: 'value', color: '#D4782F', label: 'Requests' }]}
          layout="horizontal"
          height={280}
        />
      </div>
    </div>
  );
}
