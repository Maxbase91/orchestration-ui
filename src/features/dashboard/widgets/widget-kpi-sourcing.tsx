import { useMemo } from 'react';
import { useRequests } from '@/lib/db/hooks/use-requests';
import { kpiData } from '@/data/kpi-data';
import { KPICard } from '@/components/shared/kpi-card';

export function WidgetKPISourcing() {
  const { data: requests = [] } = useRequests();
  const count = useMemo(
    () => requests.filter((r) => r.status === 'sourcing').length,
    [requests],
  );

  const sparkline = useMemo(() => kpiData.map((d) => d.activeSourcing), []);

  return (
    <KPICard
      label="Active Sourcing"
      value={count}
      sparklineData={sparkline}
      trend={{ direction: 'up', percentage: 8 }}
    />
  );
}
