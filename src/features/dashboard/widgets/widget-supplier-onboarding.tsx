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

export function WidgetSupplierOnboarding() {
  const navigate = useNavigate();
  const { data: suppliers = [], isLoading } = useSuppliers();

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

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading suppliers…</p>;
  if (blocked.length === 0) {
    return <p className="text-sm text-muted-foreground">Every supplier is onboarded and screened.</p>;
  }

  return (
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
              ? <ShieldQuestion className="size-3.5 shrink-0 text-red-500" />
              : <Building2 className="size-3.5 shrink-0 text-gray-400" />}
            <span className="truncate">{supplier.name}</span>
          </div>
          <span className={`ml-2 shrink-0 text-xs font-medium ${
            supplier.screeningStatus === 'flagged' ? 'text-red-600' : 'text-gray-600'
          }`}>
            {reason}
          </span>
        </button>
      ))}
    </div>
  );
}
