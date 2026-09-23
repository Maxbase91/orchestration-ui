import { useMemo } from 'react';
import { useRequests } from '@/lib/db/hooks/use-requests';
import { FactGrid } from '@/components/shared/fact-grid';

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
    /* Counts are live; no trend is shown rather than a fabricated one (there
       is no historical snapshot to compute a real period-over-period delta). */
    <FactGrid
      facts={[
        { label: 'Active workflows', value: activeCount },
        // The only figure here that is a problem when it is not zero.
        { label: 'Stuck or blocked', value: stuckCount, tone: stuckCount > 0 ? 'stop' : 'ink' },
        { label: 'Avg days in current step', value: `${avgDays}d` },
      ]}
    />
  );
}
