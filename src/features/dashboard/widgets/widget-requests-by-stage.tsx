// Dashboard widget: where the request book actually sits.
//
// The demand-pipeline widget beside it charts the same data as bars; this is
// the countable version — a stage, how many, and one click through to that
// filtered list. Terminal states (completed, cancelled) are left out: nothing
// in them is waiting on anyone, and including them makes the largest number on
// the widget the least actionable one.
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequests } from '@/lib/db/hooks/use-requests';
import type { RequestStatus } from '@/data/types';

/** The stages worth counting, in lifecycle order. */
const ACTIVE_STAGES: { status: RequestStatus; label: string }[] = [
  { status: 'intake', label: 'Intake' },
  { status: 'validation', label: 'Validation' },
  { status: 'risk', label: 'Risk' },
  { status: 'approval', label: 'Approval' },
  { status: 'sourcing', label: 'Sourcing' },
  { status: 'contracting', label: 'Contracting' },
  { status: 'po', label: 'Purchase order' },
  { status: 'referred-back', label: 'Referred back' },
];

export function WidgetRequestsByStage() {
  const navigate = useNavigate();
  const { data: requests = [], isLoading } = useRequests();

  const counts = useMemo(() => {
    const byStatus = new Map<string, number>();
    for (const request of requests) {
      byStatus.set(request.status, (byStatus.get(request.status) ?? 0) + 1);
    }
    return ACTIVE_STAGES
      .map((stage) => ({ ...stage, count: byStatus.get(stage.status) ?? 0 }))
      .filter((stage) => stage.count > 0);
  }, [requests]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading requests…</p>;
  if (counts.length === 0) {
    return <p className="text-sm text-muted-foreground">No requests are in an active stage.</p>;
  }

  return (
    <div className="space-y-1">
      {counts.map((stage) => (
        <button
          key={stage.status}
          type="button"
          onClick={() => navigate(`/requests?status=${stage.status}`)}
          aria-label={`Open the ${stage.count} request(s) in ${stage.label}`}
          className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50"
        >
          <span className={stage.status === 'referred-back' ? 'text-amber-700' : 'text-gray-700'}>
            {stage.label}
          </span>
          <span className={`ml-2 shrink-0 text-xs font-semibold ${
            stage.status === 'referred-back' ? 'text-amber-700' : 'text-gray-900'
          }`}>
            {stage.count}
          </span>
        </button>
      ))}
    </div>
  );
}
