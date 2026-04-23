import { KPICard } from '@/components/shared/kpi-card';
import { useLiveKpis } from '../use-live-kpis';

export function WidgetKPICycleTime() {
  const { avgCycleTime, cycleTimeSeries, cycleTimeTrend } = useLiveKpis();

  return (
    <KPICard
      label="Avg Cycle Time"
      value={`${avgCycleTime} days`}
      sparklineData={cycleTimeSeries}
      trend={cycleTimeTrend}
    />
  );
}
