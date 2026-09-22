// Dashboard widget: purchase orders still awaiting goods or closure.
//
// A PO is "open" until it is received and closed, and the ones worth a glance
// are those whose delivery date has passed with nothing (or only part) booked
// in — that is where a chased supplier or a missed receipt shows up first.
// Draft and closed POs are excluded: neither is waiting on anybody.
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PackageCheck, PackageX } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { usePurchaseOrders } from '@/lib/db/hooks/use-purchase-orders';
import { formatCurrency } from '@/lib/format';
import { AsyncBoundary } from '@/components/shared/async-boundary';

const OPEN_STATUSES = new Set(['submitted', 'acknowledged', 'partially-received']);

export function WidgetOpenPOs() {
  const navigate = useNavigate();
  // The query object, not just its data: `data ?? []` on its own cannot tell
  // an empty result from a failed read, and this widget's empty state is
  // reassuring — so a database failure reported that everything was fine.
  const query = usePurchaseOrders();
  // Memoised because `?? []` mints a new array on every render, which would
  // invalidate the memo below each time and re-sort on every parent update.
  const orders = useMemo(() => query.data ?? [], [query.data]);

  const open = useMemo(() => {
    const now = new Date();
    return orders
      .filter((po) => OPEN_STATUSES.has(po.status))
      .map((po) => ({
        ...po,
        // Negative means the delivery date has passed.
        daysToDelivery: po.deliveryDate ? differenceInDays(parseISO(po.deliveryDate), now) : null,
      }))
      // Overdue first, then soonest due — the order someone would chase in.
      .sort((a, b) => (a.daysToDelivery ?? Infinity) - (b.daysToDelivery ?? Infinity))
      .slice(0, 5);
  }, [orders]);

  return (
    <AsyncBoundary
      query={query}
      of="purchase orders"
      isEmpty={open.length === 0}
      empty="No open purchase orders."
      minHeight={72}
    >
      <div className="space-y-1">
        {open.map((po) => {
          const overdue = po.daysToDelivery !== null && po.daysToDelivery < 0;
          return (
            <button
              key={po.id}
              type="button"
              onClick={() => navigate(`/purchasing/orders/${po.id}`)}
              aria-label={`Open purchase order ${po.id} for ${po.supplierName}`}
              className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50"
            >
              <div className="flex min-w-0 items-center gap-2">
                {overdue
                  ? <PackageX className="size-3.5 shrink-0 text-stop" />
                  : <PackageCheck className="size-3.5 shrink-0 text-ink-3" />}
                <span className="truncate">{po.supplierName}</span>
                {po.status === 'partially-received' && (
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-warn">part</span>
                )}
              </div>
              <span className={`ml-2 shrink-0 text-xs font-medium ${overdue ? 'text-stop' : 'text-ink-2'}`}>
                {overdue ? `${Math.abs(po.daysToDelivery!)}d late` : formatCurrency(po.value)}
              </span>
            </button>
          );
        })}
      </div>
    </AsyncBoundary>
  );
}
