// Dashboard widget listing the contracts in their renewal window, soonest
// first — the live status, read from the end date against the governed window
// (Decisioning thresholds), as the register and Renewals & Expiries read it.
// It used to apply its own 90 days and include every contract that had ever
// ended, oldest first, so five long-lapsed contracts could fill it.
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileWarning } from 'lucide-react';
import { useContracts } from '@/lib/db/hooks/use-contracts';
import { daysUntilEnd } from '@/lib/procurement/contract-status';
import { AsyncBoundary } from '@/components/shared/async-boundary';

export function WidgetExpiringContracts() {
  const navigate = useNavigate();
  // The query object, not just its data: `data ?? []` on its own cannot tell
  // an empty result from a failed read, and this widget's empty state is
  // reassuring — so a database failure reported that everything was fine.
  const query = useContracts();
  // Memoised because `?? []` mints a new array on every render, which would
  // invalidate the memo below each time and re-sort on every parent update.
  const contracts = useMemo(() => query.data ?? [], [query.data]);

  const expiring = useMemo(() => contracts
    .filter((c) => c.status === 'expiring')
    .map((c) => ({ ...c, daysUntilExpiry: daysUntilEnd(c.endDate) ?? 0 }))
    // Soonest first; capped so the widget stays glanceable.
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
    .slice(0, 5), [contracts]);

  return (
    <AsyncBoundary
      query={query}
      of="contract alerts"
      isEmpty={expiring.length === 0}
      empty="No contracts in their renewal window."
      minHeight={72}
    >
      <div className="space-y-1">
        {expiring.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => navigate(`/contracts/${c.id}`)}
            aria-label={`Open contract details for ${c.title}`}
            className="flex items-center justify-between w-full text-left px-2 py-1.5 rounded hover:bg-muted/50 transition-colors text-sm"
          >
            <div className="flex items-center gap-2 min-w-0">
              <FileWarning className="size-3.5 shrink-0 text-warn" />
              <span className="truncate">{c.title}</span>
            </div>
            <span className="text-xs font-medium shrink-0 ml-2 text-warn">
              {c.daysUntilExpiry === 0 ? 'Ends today' : `${c.daysUntilExpiry}d left`}
            </span>
          </button>
        ))}
      </div>
    </AsyncBoundary>
  );
}
