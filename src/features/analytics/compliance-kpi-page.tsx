import { useMemo } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { KPICard } from '@/components/shared/kpi-card';
import { BarChartWidget } from '@/components/charts/bar-chart-widget';
import { LineChartWidget } from '@/components/charts/line-chart-widget';
import { useSuppliers } from '@/lib/db/hooks/use-suppliers';
import { useRequests } from '@/lib/db/hooks/use-requests';
import { useLiveComplianceKpis } from './use-live-analytics';
import { useLiveKpis } from '@/features/dashboard/use-live-kpis';

export function ComplianceKPIPage() {
  const { data: suppliers = [] } = useSuppliers();
  const { data: requests = [] } = useRequests();
  const compliance = useLiveComplianceKpis();
  const { avgCycleTime, cycleTimeSeries } = useLiveKpis();

  const sraValidCount = useMemo(
    () => suppliers.filter((s) => s.sraStatus === 'valid').length,
    [suppliers],
  );

  const sraCoverage = useMemo(
    () => (suppliers.length === 0 ? 0 : Math.round((sraValidCount / suppliers.length) * 100)),
    [sraValidCount, suppliers.length],
  );

  // Screening duplication = suppliers with same DUNS or same name (case-insensitive)
  const screeningDuplication = useMemo(() => {
    const byKey = new Map<string, number>();
    for (const s of suppliers) {
      const key = (s.duns || s.name).toLowerCase().trim();
      if (!key) continue;
      byKey.set(key, (byKey.get(key) ?? 0) + 1);
    }
    let dupes = 0;
    for (const count of byKey.values()) if (count > 1) dupes += count;
    return dupes;
  }, [suppliers]);

  const breachChartData = useMemo(() => {
    const now = new Date();
    const n = compliance.policyBreachesSeries.length;
    return compliance.policyBreachesSeries.map((value, i) => {
      const monthsAgo = n - 1 - i;
      const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
      return { name: String(d.getMonth() + 1).padStart(2, '0'), value };
    });
  }, [compliance.policyBreachesSeries]);

  const firstTimeRightData = useMemo(() => {
    const now = new Date();
    const n = compliance.firstTimeRightSeries.length;
    return compliance.firstTimeRightSeries.map((value, i) => {
      const monthsAgo = n - 1 - i;
      const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
      return { name: String(d.getMonth() + 1).padStart(2, '0'), value };
    });
  }, [compliance.firstTimeRightSeries]);

  // Cycle time by category: average days for completed requests in that category
  const cycleTimeByCategoryData = useMemo(() => {
    const buckets = new Map<string, { totalDays: number; count: number }>();
    for (const r of requests) {
      if (r.status !== 'completed') continue;
      const start = new Date(r.createdAt).getTime();
      const end = new Date(r.updatedAt ?? r.createdAt).getTime();
      const days = Math.max(0, (end - start) / 86_400_000);
      const bucket = buckets.get(r.category) ?? { totalDays: 0, count: 0 };
      bucket.totalDays += days;
      bucket.count += 1;
      buckets.set(r.category, bucket);
    }
    const label: Record<string, string> = {
      goods: 'Goods', services: 'Services', software: 'Software', consulting: 'Consulting',
      'contingent-labour': 'Contingent Labour', 'contract-renewal': 'Contract Renewal',
      'supplier-onboarding': 'Supplier Onboarding',
    };
    return Array.from(buckets.entries())
      .map(([cat, { totalDays, count }]) => ({
        name: label[cat] ?? cat,
        value: Math.round(totalDays / count),
      }))
      .sort((a, b) => b.value - a.value);
  }, [requests]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance KPIs"
        subtitle="Policy compliance, first-time-right rates, and screening metrics"
      />

      {/* KPI Grid - 3x2 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <KPICard
          label="Policy Breaches (current month)"
          value={compliance.policyBreaches}
          sparklineData={compliance.policyBreachesSeries}
        />
        <KPICard
          label="First Time Right Rate"
          value={compliance.firstTimeRight}
          format="percentage"
          sparklineData={compliance.firstTimeRightSeries}
        />
        <KPICard
          label="Refer-back Rate"
          value={`${compliance.referBackRate} / completed request`}
        />
        <KPICard
          label="SRA Coverage"
          value={sraCoverage}
          format="percentage"
        />
        <KPICard
          label="Duplicate Supplier Records"
          value={`${screeningDuplication} supplier${screeningDuplication === 1 ? '' : 's'}`}
        />
        <KPICard
          label="Avg Request Cycle Time"
          value={`${avgCycleTime} days`}
          sparklineData={cycleTimeSeries}
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
