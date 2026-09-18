// Dashboard list of requests needing intervention. "Attention" means overdue
// against SLA or referred back to the requester — the two states where waiting
// costs the most.
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, ArrowLeftCircle } from 'lucide-react';
import { useRequests } from '@/lib/db/hooks/use-requests';
import { useUserLookup, useUsers } from '@/lib/db/hooks/use-users';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency } from '@/lib/format';

export function AttentionRequiredList() {
  const navigate = useNavigate();
  useUsers();
  const lookupUser = useUserLookup();
  const { data: requests = [] } = useRequests();
  const flaggedItems = useMemo(() => {
    // Overdue items outrank referrals; within each group the longest-stuck
    // request surfaces first.
    return requests
      .filter((r) => r.isOverdue || r.status === 'referred-back')
      .sort((a, b) => {
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        return b.daysInStage - a.daysInStage;
      });
  }, [requests]);

  if (flaggedItems.length === 0) {
    return <p className="text-sm text-ink-3">No items require attention.</p>;
  }

  return (
    <div className="space-y-3">
      {flaggedItems.map((r) => {
        const owner = lookupUser(r.ownerId);
        return (
          <button
            key={r.id}
            onClick={() => navigate(`/requests/${r.id}`)}
            className="w-full flex items-start gap-3 rounded-md border border-line-2 bg-card p-3 hover:bg-card-2 transition-colors cursor-pointer text-left"
          >
            <div className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${r.isOverdue ? 'bg-stop-soft text-stop' : 'bg-warn-soft text-warn'}`}>
              {r.isOverdue ? <Clock className="size-3.5" /> : <ArrowLeftCircle className="size-3.5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-ink-3">{r.id}</span>
                <StatusBadge status={r.status} size="sm" />
                {r.isOverdue && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-stop-soft px-2 py-0.5 text-xs font-medium text-stop">
                    <AlertTriangle className="size-3" />
                    Overdue
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm font-medium text-ink truncate">{r.title}</p>
              <div className="mt-1 flex items-center gap-3 text-xs text-ink-3">
                <span>{formatCurrency(r.value, r.currency)}</span>
                <span>{r.daysInStage}d in stage</span>
                {owner && <span>Owner: {owner.name}</span>}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
