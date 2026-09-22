// Dashboard widget: suppliers that cannot yet be transacted with.
//
// Distinct from the risk-alert widget beside it. That one ranks suppliers you
// already use by risk; this one lists the ones **blocking work** — onboarding
// unfinished, screening not cleared, or a prospective record created from a
// demand and never completed. Each is a gate on sourcing, contracting or a PO,
// so the row says which gate it is rather than just naming the supplier.
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ShieldQuestion } from 'lucide-react';
import { useSuppliers } from '@/lib/db/hooks/use-suppliers';
import { AsyncBoundary } from '@/components/shared/async-boundary';

export function WidgetSupplierOnboarding() {
  const navigate = useNavigate();
  // The query object, not just its data: `data ?? []` on its own cannot tell
  // an empty result from a failed read, and this widget's empty state is
  // reassuring — so a database failure reported that everything was fine.
  const query = useSuppliers();
  // Memoised because `?? []` mints a new array on every render, which would
  // invalidate the memo below each time and re-sort on every parent update.
  const suppliers = useMemo(() => query.data ?? [], [query.data]);

  const blocked = useMemo(() =>
    suppliers
      .map((supplier) => {
        // Most blocking reason first: a flagged screening stops everything,
        // an unfinished onboarding stops contracting, a prospective record
        // stops a PO.
        const reason = supplier.screeningStatus === 'flagged' ? 'Screening flagged'
          : supplier.screeningStatus === 'pending' ? 'Screening pending'
            : supplier.onboardingStatus === 'not-started' ? 'Onboarding not started'
              : supplier.onboardingStatus === 'in-progress' ? 'Onboarding in progress'
                : supplier.prospective ? 'Prospective — never transacted'
                  : null;
        return { supplier, reason };
      })
      .filter((row): row is { supplier: typeof suppliers[number]; reason: string } => row.reason !== null)
      .slice(0, 5),
  [suppliers]);

  return (
    <AsyncBoundary
      query={query}
      of="suppliers"
      isEmpty={blocked.length === 0}
      empty="Every supplier is onboarded and screened."
      minHeight={72}
    >
      <div className="space-y-1">
        {blocked.map(({ supplier, reason }) => (
          <button
            key={supplier.id}
            type="button"
            onClick={() => navigate(`/suppliers/${supplier.id}`)}
            aria-label={`Open supplier ${supplier.name} — ${reason}`}
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50"
          >
            <div className="flex min-w-0 items-center gap-2">
              {supplier.screeningStatus === 'flagged'
                ? <ShieldQuestion className="size-3.5 shrink-0 text-stop" />
                : <Building2 className="size-3.5 shrink-0 text-ink-3" />}
              <span className="truncate">{supplier.name}</span>
            </div>
            <span className={`ml-2 shrink-0 text-xs font-medium ${
              supplier.screeningStatus === 'flagged' ? 'text-stop' : 'text-ink-2'
            }`}>
              {reason}
            </span>
          </button>
        ))}
      </div>
    </AsyncBoundary>
  );
}
