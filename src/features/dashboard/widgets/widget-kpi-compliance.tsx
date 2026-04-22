import { useMemo } from 'react';
import { useKpiData, useLatestKpi } from '@/lib/db/hooks/use-kpi-data';
import { KPICard } from '@/components/shared/kpi-card';

export function WidgetKPICompliance() {
  const { data: kpiData = [] } = useKpiData();
  const latest = useLatestKpi();
  const sparkline = useMemo(() => kpiData.map((d) => d.complianceRate), [kpiData]);

  return (
    <KPICard
      label="Compliance Rate"
      value={latest?.complianceRate ?? 0}
      format="percentage"
      sparklineData={sparkline}
      trend={{ direction: 'up', percentage: 3 }}
    />
  );
}
