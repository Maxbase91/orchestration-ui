import { useMemo } from 'react';
import { useRequests } from '@/lib/db/hooks/use-requests';
import { KPICard } from '@/components/shared/kpi-card';

const activeStatuses = new Set([
  'intake', 'validation', 'approval', 'sourcing', 'contracting', 'po', 'receipt', 'invoice', 'referred-back',
]);

const stuckStatuses = new Set(['referred-back']);

export function WorkflowHealthCards() {
  const { data: requests = [] } = useRequests();
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
  }, [requests]);

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Counts are live; no trend is shown rather than a fabricated one (there
          is no historical snapshot to compute a real period-over-period delta). */}
      <KPICard label="Active Workflows" value={activeCount} />
      <KPICard label="Stuck / Blocked" value={stuckCount} />
      <KPICard label="Avg Days in Current Step" value={`${avgDays}d`} />
    </div>
  );
}
