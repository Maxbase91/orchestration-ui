import { useMemo } from 'react';
import { requests } from '@/data/requests';
import { getUserById } from '@/data/users';
import { BarChartWidget } from '@/components/charts/bar-chart-widget';

export function WorkloadChart() {
  const data = useMemo(() => {
    const ownerCounts: Record<string, number> = {};
    const activeStatuses = new Set([
      'intake', 'validation', 'approval', 'sourcing', 'contracting', 'po', 'receipt', 'invoice', 'referred-back',
    ]);

    for (const r of requests) {
      if (!activeStatuses.has(r.status)) continue;
      ownerCounts[r.ownerId] = (ownerCounts[r.ownerId] ?? 0) + 1;
    }

    return Object.entries(ownerCounts)
      .map(([ownerId, count]) => {
        const user = getUserById(ownerId);
        return {
          name: user?.name ?? ownerId,
          value: count,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, []);

  return (
    <BarChartWidget
      data={data}
      dataKeys={[{ key: 'value', color: '#2D5F8A', label: 'Requests' }]}
      xAxisKey="name"
      height={260}
    />
  );
}
