import { useMemo } from 'react';
import { useRequests } from '@/lib/db/hooks/use-requests';
import { useKpiData } from '@/lib/db/hooks/use-kpi-data';
import { KPICard } from '@/components/shared/kpi-card';
import { formatCurrency } from '@/lib/format';

const openStatuses = new Set(['intake', 'validation', 'approval', 'sourcing', 'referred-back']);

export function WidgetKPIOpenDemand() {
  const { data: requests = [] } = useRequests();
  const { data: kpiData = [] } = useKpiData();
  const { count, value } = useMemo(() => {
    const open = requests.filter((r) => openStatuses.has(r.status));
    return { count: open.length, value: open.reduce((sum, r) => sum + r.value, 0) };
  }, [requests]);

  const sparkline = useMemo(() => kpiData.map((d) => d.openDemand), [kpiData]);

  return (
    <KPICard
      label="Open Demand"
      value={`${count} (${formatCurrency(value)})`}
      sparklineData={sparkline}
      trend={{ direction: 'up', percentage: 12 }}
    />
  );
}
