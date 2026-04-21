import { useMemo } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { KPICard } from '@/components/shared/kpi-card';
import { BarChartWidget } from '@/components/charts/bar-chart-widget';
import { PieChartWidget } from '@/components/charts/pie-chart-widget';
import { kpiData } from '@/data/kpi-data';
import { useSuppliers } from '@/lib/db/hooks/use-suppliers';
import { contracts } from '@/data/contracts';
import { formatCurrency } from '@/lib/format';

export function SpendDashboardPage() {
  const { data: suppliers = [] } = useSuppliers();

  const totalSpendYTD = useMemo(
    () => kpiData.reduce((sum, d) => sum + d.totalSpend, 0),
    [],
  );

  const totalManagedSpend = useMemo(
    () => kpiData.reduce((sum, d) => sum + d.managedSpend, 0),
    [],
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
  }, []);

  const monthlySpendData = useMemo(
    () =>
      kpiData.map((d) => ({
        name: d.month.slice(5),
        value: d.totalSpend,
      })),
    [],
  );

  const categorySpendData = useMemo(
    () => [
      { name: 'IT Consulting', value: 35, color: '#1B2A4A' },
      { name: 'Software', value: 25, color: '#2D5F8A' },
      { name: 'Professional Services', value: 20, color: '#D4782F' },
      { name: 'Facilities', value: 12, color: '#2E7D4F' },
      { name: 'Other', value: 8, color: '#718096' },
    ],
    [],
  );

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

  const contractVsOff = useMemo(
    () => [
      { name: 'On Contract', value: 72, color: '#1B2A4A' },
      { name: 'Off Contract', value: 28, color: '#D4782F' },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Spend Overview"
        subtitle="Year-to-date spend analytics and breakdown"
      />

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
