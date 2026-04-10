import { useMemo } from 'react';
import { getLatestKPI, kpiData } from '@/data/kpi-data';
import { KPICard } from '@/components/shared/kpi-card';

export function WidgetKPICycleTime() {
  const latest = useMemo(() => getLatestKPI(), []);
  const sparkline = useMemo(() => kpiData.map((d) => d.avgCycleTime), []);

  return (
    <KPICard
      label="Avg Cycle Time"
      value={`${latest.avgCycleTime} days`}
      sparklineData={sparkline}
      trend={{ direction: 'down', percentage: 5 }}
    />
  );
}
