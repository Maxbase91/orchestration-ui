import { KPICard } from '@/components/shared/kpi-card';
import { formatCurrency } from '@/lib/format';
import { useLiveKpis } from '../use-live-kpis';

export function WidgetKPIOpenDemand() {
  const { openDemandCount, openDemandValue, openDemandSeries, openDemandTrend } = useLiveKpis();

  return (
    <KPICard
      label="Open Demand"
      value={`${openDemandCount} (${formatCurrency(openDemandValue)})`}
      sparklineData={openDemandSeries}
      trend={openDemandTrend}
    />
  );
}
