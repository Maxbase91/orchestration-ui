import { useMemo } from 'react';
import { useRequests } from '@/lib/db/hooks/use-requests';
import { FactGrid } from '@/components/shared/fact-grid';

// Requests still moving through the pipeline (mirrors the live-KPI definition).
const OPEN_STATUSES = new Set(['intake', 'validation', 'approval', 'sourcing', 'referred-back']);

export function SystemHealthPanel() {
  const { data: requests = [], isLoading, isError } = useRequests();

  const stats = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekAgo = startToday - 6 * 24 * 60 * 60 * 1000; // last 7 days, today inclusive
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let today = 0;
    let week = 0;
    let month = 0;
    const activeUsers = new Set<string>();

    for (const r of requests) {
      const t = new Date(r.createdAt).getTime();
      if (t >= startToday) today += 1;
      if (t >= weekAgo) week += 1;
      if (t >= startMonth) month += 1;
      if (OPEN_STATUSES.has(r.status)) {
        activeUsers.add(r.ownerId);
        activeUsers.add(r.requestorId);
      }
    }
    return { today, week, month, activeUsers: activeUsers.size };
  }, [requests]);

  // The only upstream the SPA depends on in R1 is its own data source, so the
  // status reflects the actual query health rather than a hardcoded "Healthy".
  const dataSource = isLoading
    ? { label: 'Checking…', dot: 'bg-idle', ping: false, note: 'Verifying the data source' }
    : isError
      ? { label: 'Degraded', dot: 'bg-stop', ping: false, note: 'Data source unreachable' }
      : { label: 'Healthy', dot: 'bg-ok', ping: true, note: 'Data source responding' };

  return (
    <FactGrid
      facts={[
        { label: 'People with open work', value: stats.activeUsers },
        {
          label: 'Requests raised (today / 7d / month)',
          value: `${stats.today} / ${stats.week} / ${stats.month}`,
        },
        {
          label: 'Data source',
          // A word, not a figure, so it is set at the same size as the numbers
          // beside it rather than shouted — "Healthy" was the largest text on
          // the dashboard, above the user's own name.
          value: (
            <span className="flex items-center gap-2">
              <span className="relative flex size-2.5">
                {dataSource.ping && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-75" />
                )}
                <span className={`relative inline-flex size-2.5 rounded-full ${dataSource.dot}`} />
              </span>
              {dataSource.label}
            </span>
          ),
          tone: isError ? 'stop' : 'ink',
          note: dataSource.note,
        },
      ]}
    />
  );
}
