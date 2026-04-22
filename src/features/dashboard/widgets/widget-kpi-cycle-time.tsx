import { useMemo } from 'react';
import { useKpiData, useLatestKpi } from '@/lib/db/hooks/use-kpi-data';
import { KPICard } from '@/components/shared/kpi-card';

export function WidgetKPICycleTime() {
  const { data: kpiData = [] } = useKpiData();
  const latest = useLatestKpi();
  const sparkline = useMemo(() => kpiData.map((d) => d.avgCycleTime), [kpiData]);

  return (
    <KPICard
      label="Avg Cycle Time"
      value={`${latest?.avgCycleTime ?? 0} days`}
      sparklineData={sparkline}
      trend={{ direction: 'down', percentage: 5 }}
    />
  );
}
