// Dashboard widget listing the user's requests still in flight, capped for
// glanceability. Each row deep-links to the request detail page.
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequests } from '@/lib/db/hooks/use-requests';
import { useAuthStore } from '@/stores/auth-store';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency } from '@/lib/format';

// "Active" spans draft through invoice and includes referred-back (needs the
// requester's action); only terminal states drop off.
const activeStatuses = new Set([
  'draft', 'intake', 'validation', 'approval', 'sourcing', 'contracting', 'po', 'receipt', 'invoice', 'referred-back',
]);

export function WidgetMyRequests() {
  const navigate = useNavigate();
  const { data: requests = [] } = useRequests();
  const currentUser = useAuthStore((s) => s.currentUser);

  // Scoped to the current user. The widget is titled "My Active Requests" and
  // filtered by no user at all, so every role saw the whole organisation's
  // pipeline under a personal heading.
  const activeRequests = useMemo(
    () =>
      requests
        .filter(
          (r) =>
            activeStatuses.has(r.status) &&
            (r.ownerId === currentUser.id || r.requestorId === currentUser.id),
        )
        .slice(0, 8),
    [requests, currentUser.id],
  );

  if (activeRequests.length === 0) {
    return <p className="text-sm text-muted-foreground">You have no active requests.</p>;
  }

  return (
    <div className="space-y-1">
      {activeRequests.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => navigate(`/requests/${r.id}`)}
          className="flex items-center justify-between w-full text-left px-2 py-1.5 rounded hover:bg-muted/50 transition-colors text-sm"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-xs text-muted-foreground shrink-0">{r.id}</span>
            <span className="truncate">{r.title}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <StatusBadge status={r.status} size="sm" />
            <span className="text-xs text-muted-foreground w-20 text-right">{formatCurrency(r.value)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
