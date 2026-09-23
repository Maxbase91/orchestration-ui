// Dashboard widget with this month's throughput counters (submitted /
// approved / completed).
//
// Two of the three are proxies, and the screen now says so. Requests carry no
// per-event history, so "approved" means "updated this month and already past
// the approval stage" — close enough to be useful, not close enough to present
// as a count of approvals.
import { useMemo } from 'react';
import { FileText, CheckCircle, PackageCheck } from 'lucide-react';
import { useRequests } from '@/lib/db/hooks/use-requests';

export function WidgetQuickStats() {
  const { data: requests = [] } = useRequests();
  const stats = useMemo(() => {
    const now = new Date();
    // ISO timestamps let "this month" be a cheap string-prefix match.
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Approved/completed are proxies: requests carry no per-event history, so
    // "approved" = updated this month and already past the approval stage.
    const submitted = requests.filter((r) => r.createdAt.startsWith(thisMonth)).length;
    const approved = requests.filter(
      (r) => r.updatedAt.startsWith(thisMonth) && ['sourcing', 'contracting', 'po', 'receipt', 'invoice', 'payment', 'completed'].includes(r.status),
    ).length;
    const completed = requests.filter(
      (r) => r.updatedAt.startsWith(thisMonth) && (r.status === 'completed' || r.status === 'payment'),
    ).length;

    return { submitted, approved, completed };
  }, [requests]);

  const rows = [
    { icon: FileText, label: 'Submitted', value: stats.submitted },
    { icon: CheckCircle, label: 'Approved', value: stats.approved },
    { icon: PackageCheck, label: 'Completed', value: stats.completed },
  ];

  return (
    <div>
      {/* Label left, figure right, hairline between: three counts of the same
          kind read down a column, not across three tinted chips. */}
      <dl className="divide-y divide-line">
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center justify-between gap-2 py-1.5">
            <dt className="flex items-center gap-2 text-body text-ink-2">
              <Icon className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
              {label} this month
            </dt>
            <dd className="text-body font-semibold tabular-nums text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-caption text-ink-3">
        Approved and completed are read from each request&rsquo;s current stage — there is no
        per-decision history to count.
      </p>
    </div>
  );
}
