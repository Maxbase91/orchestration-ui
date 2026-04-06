import { useMemo } from 'react';
import { requests } from '@/data/requests';
import { BarChartWidget } from '@/components/charts/bar-chart-widget';
import type { RequestStatus } from '@/data/types';

const stageOrder: { key: RequestStatus; label: string }[] = [
  { key: 'intake', label: 'Intake' },
  { key: 'validation', label: 'Validation' },
  { key: 'approval', label: 'Approval' },
  { key: 'sourcing', label: 'Sourcing' },
  { key: 'contracting', label: 'Contracting' },
  { key: 'po', label: 'PO' },
];

export function DemandPipelineChart() {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const stage of stageOrder) {
      counts[stage.key] = 0;
    }
    for (const r of requests) {
      if (counts[r.status] !== undefined) {
        counts[r.status]++;
      }
    }
    return stageOrder.map((stage) => ({
      name: stage.label,
      value: counts[stage.key],
    }));
  }, []);

  return (
    <BarChartWidget
      data={data}
      dataKeys={[{ key: 'value', color: '#1B2A4A', label: 'Requests' }]}
      xAxisKey="name"
      height={260}
      layout="vertical"
    />
  );
}
