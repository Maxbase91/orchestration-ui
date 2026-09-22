// Dashboard widget: invoices that cannot pay themselves.
//
// The useful cut is not "all invoices" — it is the ones a human has to resolve:
// a disputed invoice, a three-way match that came back unmatched or with a
// variance, and anything past its due date but not yet paid. Everything else
// flows through without attention and would only dilute the list.
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReceiptText, TriangleAlert } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { useInvoices } from '@/lib/db/hooks/use-invoices';
import { formatCurrency } from '@/lib/format';
import { AsyncBoundary } from '@/components/shared/async-boundary';

export function WidgetInvoiceExceptions() {
  const navigate = useNavigate();
  // The query object, not just its data: `data ?? []` on its own cannot tell
  // an empty result from a failed read, and this widget's empty state is
  // reassuring — so a database failure reported that everything was fine.
  const query = useInvoices();
  // Memoised because `?? []` mints a new array on every render, which would
  // invalidate the memo below each time and re-sort on every parent update.
  const invoices = useMemo(() => query.data ?? [], [query.data]);

  const exceptions = useMemo(() => {
    const now = new Date();
    return invoices
      .map((invoice) => {
        const overdueDays = invoice.dueDate && invoice.status !== 'paid'
          ? differenceInDays(now, parseISO(invoice.dueDate))
          : 0;
        // One reason per row, most serious first — a list where every row says
        // "exception" tells the reader nothing about what to do.
        const reason = invoice.status === 'disputed' ? 'Disputed'
          : invoice.matchStatus === 'unmatched' ? 'No PO match'
            : invoice.matchStatus === 'variance' ? 'Price variance'
              : invoice.matchStatus === 'partial-match' ? 'Partial match'
                : overdueDays > 0 ? `${overdueDays}d overdue`
                  : null;
        return { invoice, reason, overdueDays };
      })
      .filter((row): row is { invoice: typeof invoices[number]; reason: string; overdueDays: number } =>
        row.reason !== null)
      .sort((a, b) => b.overdueDays - a.overdueDays)
      .slice(0, 5);
  }, [invoices]);

  return (
    <AsyncBoundary
      query={query}
      of="invoices"
      isEmpty={exceptions.length === 0}
      empty="No invoice exceptions — nothing needs a decision."
      minHeight={72}
    >
      <div className="space-y-1">
        {exceptions.map(({ invoice, reason }) => (
          <button
            key={invoice.id}
            type="button"
            onClick={() => navigate('/purchasing/invoices')}
            aria-label={`Open invoices — ${invoice.id} from ${invoice.supplierName} needs attention: ${reason}`}
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50"
          >
            <div className="flex min-w-0 items-center gap-2">
              {invoice.status === 'disputed'
                ? <TriangleAlert className="size-3.5 shrink-0 text-stop" />
                : <ReceiptText className="size-3.5 shrink-0 text-warn" />}
              <span className="truncate">{invoice.supplierName}</span>
              <span className="shrink-0 text-xs text-ink-3">{formatCurrency(invoice.amount, invoice.currency)}</span>
            </div>
            <span className="ml-2 shrink-0 text-xs font-medium text-warn">{reason}</span>
          </button>
        ))}
      </div>
    </AsyncBoundary>
  );
}
