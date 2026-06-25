import { useMemo } from 'react';
import { useRequests } from '@/lib/db/hooks/use-requests';
import { KPICard } from '@/components/shared/kpi-card';

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
    ? { label: 'Checking…', dot: 'bg-gray-400', ping: false, note: 'Verifying the data source' }
    : isError
      ? { label: 'Degraded', dot: 'bg-red-500', ping: false, note: 'Data source unreachable' }
      : { label: 'Healthy', dot: 'bg-green-500', ping: true, note: 'Data source responding' };

  return (
    <div className="grid grid-cols-3 gap-4">
      <KPICard label="Active Users" value={stats.activeUsers} />
      <KPICard
        label="Requests (today / 7d / month)"
        value={`${stats.today} / ${stats.week} / ${stats.month}`}
      />
      <div className="rounded-md bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
        <p className="text-xs font-medium text-muted-foreground">Data Source</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="relative flex size-2.5">
            {dataSource.ping && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            )}
            <span className={`relative inline-flex size-2.5 rounded-full ${dataSource.dot}`} />
          </span>
          <p className="text-2xl font-semibold text-gray-900">{dataSource.label}</p>
        </div>
        <p className="mt-0.5 text-xs text-gray-500">{dataSource.note}</p>
      </div>
    </div>
  );
}
