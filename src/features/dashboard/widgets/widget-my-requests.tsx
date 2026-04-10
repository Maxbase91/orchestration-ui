import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { requests } from '@/data/requests';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency } from '@/lib/format';

const activeStatuses = new Set([
  'draft', 'intake', 'validation', 'approval', 'sourcing', 'contracting', 'po', 'receipt', 'invoice', 'referred-back',
]);

export function WidgetMyRequests() {
  const navigate = useNavigate();

  const activeRequests = useMemo(
    () => requests.filter((r) => activeStatuses.has(r.status)).slice(0, 8),
    [],
  );

  if (activeRequests.length === 0) {
    return <p className="text-sm text-muted-foreground">No active requests.</p>;
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
