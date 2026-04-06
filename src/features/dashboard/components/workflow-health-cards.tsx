import { useMemo } from 'react';
import { requests } from '@/data/requests';
import { KPICard } from '@/components/shared/kpi-card';

const activeStatuses = new Set([
  'intake', 'validation', 'approval', 'sourcing', 'contracting', 'po', 'receipt', 'invoice', 'referred-back',
]);

const stuckStatuses = new Set(['referred-back']);

export function WorkflowHealthCards() {
  const { activeCount, stuckCount, avgDays } = useMemo(() => {
    const active = requests.filter((r) => activeStatuses.has(r.status));
    const stuck = requests.filter(
      (r) => stuckStatuses.has(r.status) || r.isOverdue
    );
    const totalDays = active.reduce((sum, r) => sum + r.daysInStage, 0);
    const avg = active.length > 0 ? Math.round(totalDays / active.length) : 0;

    return {
      activeCount: active.length,
      stuckCount: stuck.length,
      avgDays: avg,
    };
  }, []);

  return (
    <div className="grid grid-cols-3 gap-4">
      <KPICard
        label="Active Workflows"
        value={activeCount}
        trend={{ direction: 'up', percentage: 8 }}
      />
      <KPICard
        label="Stuck / Blocked"
        value={stuckCount}
        trend={stuckCount > 0 ? { direction: 'up', percentage: 15 } : { direction: 'flat', percentage: 0 }}
      />
      <KPICard
        label="Avg Days in Current Step"
        value={`${avgDays}d`}
        trend={{ direction: 'down', percentage: 5 }}
      />
    </div>
  );
}
