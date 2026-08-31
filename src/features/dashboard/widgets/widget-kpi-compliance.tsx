import { KPICard } from '@/components/shared/kpi-card';
import { useLiveKpis } from '../use-live-kpis';

export function WidgetKPICompliance() {
  const { complianceRate, complianceSeries, complianceTrend } = useLiveKpis();

  return (
    <KPICard
      label="Compliance rate (latest completed)"
      value={complianceRate}
      format="percentage"
      sparklineData={complianceSeries}
      trend={complianceTrend}
    />
  );
}
