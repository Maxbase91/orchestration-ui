import { useMemo } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { KPICard } from '@/components/shared/kpi-card';
import { BarChartWidget } from '@/components/charts/bar-chart-widget';
import { PieChartWidget } from '@/components/charts/pie-chart-widget';
import { useKpiData } from '@/lib/db/hooks/use-kpi-data';
import { useSuppliers } from '@/lib/db/hooks/use-suppliers';
import { useContracts } from '@/lib/db/hooks/use-contracts';
import { useRequests } from '@/lib/db/hooks/use-requests';
import { formatCurrency } from '@/lib/format';
import { SpendAnomaliesCard } from './components/spend-anomalies-card';

const CATEGORY_LABEL: Record<string, string> = {
  goods: 'Goods',
  services: 'Services',
  software: 'Software',
  consulting: 'Consulting',
  'contingent-labour': 'Contingent Labour',
  'contract-renewal': 'Contract Renewal',
  'supplier-onboarding': 'Supplier Onboarding',
};

const CATEGORY_COLOR: Record<string, string> = {
  goods: '#2E7D4F',
  services: '#2D5F8A',
  software: '#1B2A4A',
  consulting: '#D4782F',
  'contingent-labour': '#B5392E',
  'contract-renewal': '#718096',
  'supplier-onboarding': '#8E44AD',
};

export function SpendDashboardPage() {
  const { data: suppliers = [] } = useSuppliers();
  const { data: contracts = [] } = useContracts();
  const { data: kpiData = [] } = useKpiData();
  const { data: requests = [] } = useRequests();

  const totalSpendYTD = useMemo(
    () => kpiData.reduce((sum, d) => sum + d.totalSpend, 0),
    [kpiData],
  );

  const totalManagedSpend = useMemo(
    () => kpiData.reduce((sum, d) => sum + d.managedSpend, 0),
    [kpiData],
  );

  const managedPct = useMemo(
    () => Math.round((totalManagedSpend / totalSpendYTD) * 100),
    [totalManagedSpend, totalSpendYTD],
  );

  const topSupplier = useMemo(() => {
    const active = suppliers.filter((s) => s.totalSpend12m > 0);
    return active.sort((a, b) => b.totalSpend12m - a.totalSpend12m)[0];
  }, [suppliers]);

  const avgContractValue = useMemo(() => {
    const activeContracts = contracts.filter((c) => c.status === 'active');
    if (activeContracts.length === 0) return 0;
    return Math.round(
      activeContracts.reduce((sum, c) => sum + c.value, 0) / activeContracts.length,
    );
  }, [contracts]);

  const monthlySpendData = useMemo(
    () =>
      kpiData.map((d) => ({
        name: d.month.slice(5),
        value: d.totalSpend,
      })),
    [kpiData],
  );

  const categorySpendData = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of requests) {
      const value = r.value ?? 0;
      if (value <= 0) continue;
      totals.set(r.category, (totals.get(r.category) ?? 0) + value);
    }
    const sum = Array.from(totals.values()).reduce((a, b) => a + b, 0) || 1;
    return Array.from(totals.entries())
      .map(([cat, total]) => ({
        name: CATEGORY_LABEL[cat] ?? cat,
        value: Math.round((total / sum) * 100),
        color: CATEGORY_COLOR[cat] ?? '#718096',
      }))
      .sort((a, b) => b.value - a.value);
  }, [requests]);

  const topSuppliersBySpend = useMemo(() => {
    const active = suppliers.filter((s) => s.totalSpend12m > 0);
    return active.sort((a, b) => b.totalSpend12m - a.totalSpend12m).slice(0, 20);
  }, [suppliers]);

  const maxSupplierSpend = useMemo(
    () => (topSuppliersBySpend.length > 0 ? topSuppliersBySpend[0].totalSpend12m : 1),
    [topSuppliersBySpend],
  );

  const managedVsUnmanaged = useMemo(
    () => [
      { name: 'Managed Spend', value: totalManagedSpend, color: '#2E7D4F' },
      { name: 'Unmanaged Spend', value: totalSpendYTD - totalManagedSpend, color: '#B5392E' },
    ],
    [totalManagedSpend, totalSpendYTD],
  );

  const contractVsOff = useMemo(() => {
    // Count spend value split by whether the request is linked to a contract.
    const onContract = requests.reduce(
      (sum, r) => sum + (r.contractId ? (r.value ?? 0) : 0),
      0,
    );
    const offContract = requests.reduce(
      (sum, r) => sum + (!r.contractId ? (r.value ?? 0) : 0),
      0,
    );
    const total = onContract + offContract || 1;
    return [
      { name: 'On Contract', value: Math.round((onContract / total) * 100), color: '#1B2A4A' },
      { name: 'Off Contract', value: Math.round((offContract / total) * 100), color: '#D4782F' },
    ];
  }, [requests]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Spend Overview"
        subtitle="Year-to-date spend analytics and breakdown"
      />

      {/* AI-driven Anomaly Detection */}
      <SpendAnomaliesCard />

      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Total Spend YTD"
          value={totalSpendYTD}
          format="currency"
          trend={{ direction: 'up', percentage: 14 }}
          sparklineData={kpiData.map((d) => d.totalSpend)}
        />
        <KPICard
          label="Managed Spend %"
          value={managedPct}
          format="percentage"
          trend={{ direction: 'up', percentage: 5 }}
          sparklineData={kpiData.map((d) =>
            Math.round((d.managedSpend / d.totalSpend) * 100),
          )}
        />
        <KPICard
          label="Top Supplier Spend"
          value={topSupplier?.name ?? 'N/A'}
          sparklineData={topSupplier?.spendHistory.map((h) => h.amount)}
        />
        <KPICard
          label="Avg Contract Value"
          value={avgContractValue}
          format="currency"
          trend={{ direction: 'flat', percentage: 2 }}
        />
      </div>

      {/* Spend by Period + Spend by Category */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-md bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Spend by Period</h3>
          <BarChartWidget
            data={monthlySpendData}
            dataKeys={[{ key: 'value', color: '#1B2A4A', label: 'Total Spend' }]}
            height={300}
          />
        </div>
        <div className="rounded-md bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Spend by Category</h3>
          <PieChartWidget
            data={categorySpendData}
            height={300}
            showLabels
            showLegend
          />
        </div>
      </div>

      {/* Top 20 Suppliers by Spend */}
      <div className="rounded-md bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">Top 20 Suppliers by Spend</h3>
        <div className="space-y-2">
          {topSuppliersBySpend.map((s) => (
            <div key={s.id} className="flex items-center gap-4">
              <span className="w-48 shrink-0 truncate text-sm text-gray-700">{s.name}</span>
              <div className="flex-1">
                <div className="h-5 rounded bg-gray-100">
                  <div
                    className="h-5 rounded bg-[#1B2A4A]"
                    style={{
                      width: `${(s.totalSpend12m / maxSupplierSpend) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <span className="w-28 shrink-0 text-right text-sm font-medium text-gray-900">
                {formatCurrency(s.totalSpend12m)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Managed vs Unmanaged + Contract vs Off-Contract */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-md bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Managed vs Unmanaged</h3>
          <PieChartWidget
            data={managedVsUnmanaged}
            height={280}
            innerRadius={60}
            showLegend
          />
        </div>
        <div className="rounded-md bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Contract vs Off-Contract</h3>
          <PieChartWidget
            data={contractVsOff}
            height={280}
            innerRadius={60}
            showLegend
          />
        </div>
      </div>
    </div>
  );
}
