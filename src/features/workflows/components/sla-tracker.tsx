import { SLACountdown } from '@/components/shared/sla-countdown';
import { StatusBadge } from '@/components/shared/status-badge';
import { useUserLookup, useUsers } from '@/lib/db/hooks/use-users';
import { formatCurrency } from '@/lib/format';
import type { ProcurementRequest } from '@/data/types';
import { cn } from '@/lib/utils';

interface SLATrackerProps {
  requests: ProcurementRequest[];
}

export function SLATracker({ requests }: SLATrackerProps) {
  useUsers();
  const lookupUser = useUserLookup();
  // Show requests that have an SLA deadline (approaching or past)
  const slaRequests = requests
    .filter((r) => r.slaDeadline)
    .sort((a, b) => {
      // Overdue first, then by days in stage descending
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return b.daysInStage - a.daysInStage;
    });

  // Also show requests approaching SLA (high daysInStage but no explicit deadline)
  const atRiskRequests = requests
    .filter(
      (r) =>
        !r.slaDeadline &&
        r.daysInStage >= 4 &&
        r.status !== 'completed' &&
        r.status !== 'cancelled',
    )
    .sort((a, b) => b.daysInStage - a.daysInStage)
    .slice(0, 5);

  const allTracked = [...slaRequests, ...atRiskRequests];

  if (allTracked.length === 0) {
    return (
      <div className="rounded-md border bg-white p-6 text-center text-sm text-muted-foreground">
        No SLA concerns at the moment.
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-white shadow-sm">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">
          SLA Tracker ({allTracked.length})
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Requests approaching or past SLA deadline
        </p>
      </div>
      <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
        {allTracked.map((req) => {
          const owner = lookupUser(req.ownerId);
          return (
            <div
              key={req.id}
              className={cn(
                'rounded-md border p-3',
                req.isOverdue
                  ? 'border-red-300 bg-red-50/50'
                  : 'border-amber-300 bg-amber-50/50',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-mono text-muted-foreground">
                  {req.id}
                </span>
                <StatusBadge status={req.status} size="sm" />
              </div>
              <p className="mt-1 text-sm font-medium text-gray-900 line-clamp-1">
                {req.title}
              </p>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{owner?.name ?? '—'}</span>
                <span className="font-medium">
                  {formatCurrency(req.value, req.currency)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {req.daysInStage}d in stage
                </span>
                {req.slaDeadline ? (
                  <SLACountdown deadline={req.slaDeadline} compact />
                ) : (
                  <span className="text-xs font-medium text-amber-600">
                    Approaching SLA
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
