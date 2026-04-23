import { KPICard } from '@/components/shared/kpi-card';
import { useLiveKpis } from '../use-live-kpis';

export function WidgetKPISourcing() {
  const { activeSourcing, sourcingSeries, sourcingTrend } = useLiveKpis();

  return (
    <KPICard
      label="Active Sourcing"
      value={activeSourcing}
      sparklineData={sourcingSeries}
      trend={sourcingTrend}
    />
  );
}
