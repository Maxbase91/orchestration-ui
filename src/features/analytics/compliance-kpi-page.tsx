import { useMemo } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { KPICard } from '@/components/shared/kpi-card';
import { BarChartWidget } from '@/components/charts/bar-chart-widget';
import { LineChartWidget } from '@/components/charts/line-chart-widget';
import { kpiData, getLatestKPI } from '@/data/kpi-data';
import { suppliers } from '@/data/suppliers';

export function ComplianceKPIPage() {
  const latest = getLatestKPI();

  const totalPolicyBreaches = useMemo(
    () => kpiData.reduce((sum, d) => sum + d.policyBreaches, 0),
    [],
  );

  const tpraValidCount = useMemo(
    () => suppliers.filter((s) => s.tpraStatus === 'valid').length,
    [],
  );

  const tpraCoverage = useMemo(
    () => Math.round((tpraValidCount / suppliers.length) * 100),
    [tpraValidCount],
  );

  const breachChartData = useMemo(
    () =>
      kpiData.map((d) => ({
        name: d.month.slice(5),
        value: d.policyBreaches,
      })),
    [],
  );

  const firstTimeRightData = useMemo(
    () =>
      kpiData.map((d) => ({
        name: d.month.slice(5),
        value: d.firstTimeRight,
      })),
    [],
  );

  const cycleTimeByCategoryData = useMemo(
    () => [
      { name: 'Goods', value: 8 },
      { name: 'Services', value: 12 },
      { name: 'Software', value: 15 },
      { name: 'Consulting', value: 18 },
    ],
    [],
  );

  // Mock DEUBA accuracy trend
  const deubaData = useMemo(
    () => [82, 83, 84, 85, 85, 86, 86, 87, 87, 88, 87, 87],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance KPIs"
        subtitle="Policy compliance, first-time-right rates, and screening metrics"
      />

      {/* KPI Grid - 3x2 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <KPICard
          label="Policy Breaches"
          value={`${totalPolicyBreaches} potential / 11 confirmed (YTD)`}
          trend={{ direction: 'down', percentage: 38 }}
          sparklineData={kpiData.map((d) => d.policyBreaches)}
        />
        <KPICard
          label="First Time Right Rate"
          value={latest.firstTimeRight}
          format="percentage"
          trend={{ direction: 'up', percentage: 25 }}
          sparklineData={kpiData.map((d) => d.firstTimeRight)}
        />
        <KPICard
          label="DEUBA Accuracy"
          value={87}
          format="percentage"
          trend={{ direction: 'up', percentage: 6 }}
          sparklineData={deubaData}
        />
        <KPICard
          label="TPRA Coverage"
          value={tpraCoverage}
          format="percentage"
          trend={{ direction: 'up', percentage: 3 }}
          sparklineData={[62, 65, 68, 70, 72, 73, 74, 75, 76, 77, 78, tpraCoverage]}
        />
        <KPICard
          label="Screening Duplication"
          value="12 suppliers"
          trend={{ direction: 'down', percentage: 8 }}
          sparklineData={[20, 19, 18, 17, 16, 15, 14, 14, 13, 13, 12, 12]}
        />
        <KPICard
          label="Avg Request Cycle Time"
          value={`${latest.avgCycleTime} days`}
          trend={{ direction: 'down', percentage: 31 }}
          sparklineData={kpiData.map((d) => d.avgCycleTime)}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-md bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Policy Breaches by Month</h3>
          <BarChartWidget
            data={breachChartData}
            dataKeys={[{ key: 'value', color: '#B5392E', label: 'Breaches' }]}
            height={300}
          />
        </div>
        <div className="rounded-md bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">First Time Right Trend</h3>
          <LineChartWidget
            data={firstTimeRightData}
            dataKeys={[{ key: 'value', color: '#2E7D4F', label: 'First Time Right %' }]}
            height={300}
          />
        </div>
      </div>

      {/* Cycle Time by Category */}
      <div className="rounded-md bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">Cycle Time by Category</h3>
        <BarChartWidget
          data={cycleTimeByCategoryData}
          dataKeys={[{ key: 'value', color: '#2D5F8A', label: 'Avg Days' }]}
          height={280}
        />
      </div>
    </div>
  );
}
