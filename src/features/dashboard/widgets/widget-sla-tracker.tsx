import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Timer } from 'lucide-react';
import { requests } from '@/data/requests';

export function WidgetSLATracker() {
  const navigate = useNavigate();

  const atRisk = useMemo(
    () =>
      requests
        .filter((r) => r.isOverdue || r.daysInStage > 20)
        .sort((a, b) => b.daysInStage - a.daysInStage)
        .slice(0, 4),
    [],
  );

  if (atRisk.length === 0) {
    return <p className="text-sm text-muted-foreground">All requests within SLA.</p>;
  }

  return (
    <div className="space-y-1">
      {atRisk.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => navigate(`/requests/${r.id}`)}
          className="flex items-center justify-between w-full text-left px-2 py-1.5 rounded hover:bg-muted/50 transition-colors text-sm"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Timer className={`size-3.5 shrink-0 ${r.isOverdue ? 'text-red-500' : 'text-amber-500'}`} />
            <span className="font-mono text-xs text-muted-foreground shrink-0">{r.id}</span>
            <span className="truncate">{r.title}</span>
          </div>
          <span className={`text-xs font-medium shrink-0 ml-2 ${r.isOverdue ? 'text-red-600' : 'text-amber-600'}`}>
            {r.daysInStage}d in stage
          </span>
        </button>
      ))}
    </div>
  );
}
