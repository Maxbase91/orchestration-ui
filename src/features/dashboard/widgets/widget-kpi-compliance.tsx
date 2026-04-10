import { useMemo } from 'react';
import { getLatestKPI, kpiData } from '@/data/kpi-data';
import { KPICard } from '@/components/shared/kpi-card';

export function WidgetKPICompliance() {
  const latest = useMemo(() => getLatestKPI(), []);
  const sparkline = useMemo(() => kpiData.map((d) => d.complianceRate), []);

  return (
    <KPICard
      label="Compliance Rate"
      value={latest.complianceRate}
      format="percentage"
      sparklineData={sparkline}
      trend={{ direction: 'up', percentage: 3 }}
    />
  );
}
