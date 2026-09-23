// All Requests and My Requests — one table, filtered by the URL.
//
// The list used to read no parameters at all, so every link into it with a
// filter — the dashboard's attention band, Requests by Stage, the assistant's
// "Overdue Requests" — opened the same unfiltered list. The filters are now a
// contract in request-list-filters.ts: the links build their URLs with it and
// this page reads them with it, and whatever is active is shown as a chip the
// reader can remove, so a filtered list never looks like the whole one.
//
// Category names come from the configured categories rather than a map in this
// file, which had drifted: it knew seven categories and labelled any new one
// with its raw id.
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';
import { useRequests } from '@/lib/db/hooks/use-requests';
import { useAuthStore } from '@/stores/auth-store';
import { useUserLookup, useUsers } from '@/lib/db/hooks/use-users';
import { useCategoryLabel } from '@/lib/db/hooks/use-procurement-categories';
import { StatusBadge } from '@/components/shared/status-badge';
import { PriorityIndicator } from '@/components/shared/priority-indicator';
import { AsyncBoundary } from '@/components/shared/async-boundary';
import { DataTable, type Column } from '@/components/shared/data-table';
import { formatCurrency } from '@/lib/format';
import { getStatusLabel } from '@/lib/status';
import type { ProcurementRequest, RequestStatus } from '@/data/types';
import {
  REQUEST_STATUSES, applyRequestListFilters, hasRequestListFilters,
  parseRequestListFilters, requestListHref, type RequestListFilters,
} from '@/lib/procurement/request-list-filters';

interface RequestListPageProps {
  title: string;
  filterMine?: boolean;
}

type Row = ProcurementRequest & Record<string, unknown>;

/** What each active filter says about the rows, in the reader's words. */
const VIEW_LABEL: Record<NonNullable<RequestListFilters['view']>, string> = {
  'my-overdue': 'Past the stage SLA — yours',
  'sent-back-to-me': 'Sent back to you',
};

export function RequestListPage({ title, filterMine = false }: RequestListPageProps) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  useUsers();
  const lookupUser = useUserLookup();
  const categoryLabel = useCategoryLabel();
  const query = useRequests();
  const currentUser = useAuthStore((s) => s.currentUser);

  const base = filterMine ? '/requests/my' : '/requests';
  const { ignored, ...filters } = parseRequestListFilters(params);

  // "My Requests" is either side of the request: raised it, or owns it.
  const scoped = filterMine
    ? (query.data ?? []).filter((r) => r.ownerId === currentUser.id || r.requestorId === currentUser.id)
    : (query.data ?? []);
  const rows = applyRequestListFilters(scoped, filters, currentUser.id) as Row[];

  /** The same filters with one removed — each chip's ✕. */
  const without = (key: keyof RequestListFilters) => requestListHref({ ...filters, [key]: undefined }, base);

  const chips: { key: keyof RequestListFilters; label: string }[] = [
    ...(filters.view ? [{ key: 'view' as const, label: VIEW_LABEL[filters.view] }] : []),
    ...(filters.status ? [{ key: 'status' as const, label: `Stage: ${getStatusLabel(filters.status)}` }] : []),
    ...(filters.overdue ? [{ key: 'overdue' as const, label: 'Past the stage SLA' }] : []),
  ];

  const columns: Column<Row>[] = [
    {
      key: 'id', label: 'ID', width: '132px', sortable: true,
      // A real link, so the request is reachable by keyboard and can be opened
      // in a new tab; the row click stays for the mouse.
      render: (r) => (
        <Link
          to={`/requests/${r.id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-caption text-ink-2 hover:text-accent hover:underline"
        >
          {r.id}
        </Link>
      ),
    },
    {
      key: 'title', label: 'Title', sortable: true,
      render: (r) => <span className="block truncate text-body font-medium text-ink">{r.title}</span>,
    },
    {
      key: 'category', label: 'Category', width: '140px', sortable: true,
      render: (r) => <span className="text-caption text-ink-2">{categoryLabel(r.category)}</span>,
    },
    {
      key: 'status', label: 'Stage', width: '128px', sortable: true,
      render: (r) => <StatusBadge status={r.status} size="sm" />,
    },
    {
      key: 'value', label: 'Value', width: '120px', sortable: true, numeric: true,
      render: (r) => <span className="text-body">{formatCurrency(r.value, r.currency)}</span>,
    },
    {
      key: 'ownerId', label: 'Owner', width: '150px',
      render: (r) => <span className="text-caption text-ink-2">{lookupUser(r.ownerId)?.name ?? '—'}</span>,
    },
    {
      key: 'daysInStage', label: 'In stage', width: '96px', sortable: true, numeric: true,
      // "late" in words as well as red: a colour alone is not a state.
      render: (r) => (
        <span className={r.isOverdue ? 'font-medium text-stop' : 'text-ink-2'}>
          {r.daysInStage}d{r.isOverdue && ' · late'}
        </span>
      ),
    },
    {
      key: 'priority', label: 'Priority', width: '88px',
      render: (r) => <PriorityIndicator priority={r.priority} showLabel />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-heading font-semibold text-ink">{title}</h1>
          {!query.isLoading && !query.isError && (
            <span className="text-caption tabular-nums text-ink-3">
              {hasRequestListFilters(filters) ? `${rows.length} of ${scoped.length}` : `${rows.length}`} requests
            </span>
          )}
        </div>
        <label className="flex items-center gap-2 text-caption text-ink-3">
          Stage
          <select
            value={filters.status ?? ''}
            onChange={(e) => navigate(requestListHref(
              { ...filters, status: (e.target.value || undefined) as RequestStatus | undefined }, base,
            ))}
            className="h-8 rounded-md border border-line bg-card px-2 text-body text-ink"
          >
            <option value="">All stages</option>
            {REQUEST_STATUSES.map((s) => <option key={s} value={s}>{getStatusLabel(s)}</option>)}
          </select>
        </label>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
          <span className="text-caption text-ink-3">Showing</span>
          {chips.map((chip) => (
            <Link
              key={chip.key}
              to={without(chip.key)}
              aria-label={`Remove filter: ${chip.label}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-accent-line bg-accent-soft px-2.5 py-0.5 text-caption font-medium text-accent hover:bg-card"
            >
              {chip.label}
              <X className="size-3" aria-hidden="true" />
            </Link>
          ))}
          {chips.length > 1 && (
            <Link to={base} className="text-caption text-ink-3 underline-offset-2 hover:text-ink hover:underline">
              Clear all
            </Link>
          )}
        </div>
      )}

      {/* A misspelt parameter is reported, not dropped: otherwise the list shows
          everything under a URL its reader believes is filtered. */}
      {ignored.length > 0 && (
        <p className="flex items-center gap-2 text-caption text-warn">
          <AlertTriangle className="size-3.5" aria-hidden="true" />
          Ignored a filter this list does not recognise: {ignored.join(', ')}
        </p>
      )}

      <div className="rounded-md border border-line bg-card">
        <AsyncBoundary query={query} of="requests">
          <DataTable
            columns={columns}
            data={rows}
            searchable
            searchPlaceholder="Search by ID, title or category…"
            onRowClick={(r) => navigate(`/requests/${r.id}`)}
            emptyMessage={hasRequestListFilters(filters)
              ? 'No requests match these filters.'
              : 'No requests yet.'}
          />
        </AsyncBoundary>
      </div>
    </div>
  );
}
