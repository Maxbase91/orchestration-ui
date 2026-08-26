// Sourcing event list page: the register of RFI/RFP/RFQ events, with status,
// type and category filters; rows deep-link into the event detail page.
//
// Reads live events through useSourcingEvents(). It previously rendered a
// hardcoded `mockEvents` array while the New Event wizard wrote to Postgres, so
// a published event was stored and then invisible everywhere in the UI — the
// register and the writer were looking at different worlds.
//
// The Suppliers column counts real invitations from sourcing_responses. It was
// omitted while nothing wrote to that table — a column reading 0 for every event
// would have looked like data rather than an unbuilt feature.
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { FilterBar, type FilterConfig } from '@/components/shared/filter-bar';
import { formatDate } from '@/lib/format';
import { useSourcingEvents } from '@/lib/db/hooks/use-sourcing-events';
import { useUserLookup } from '@/lib/db/hooks/use-users';
import { useAllSourcingResponses } from '@/lib/db/hooks/use-sourcing-responses';

/** Row shape for the table — the DB event plus the resolved owner name. */
interface EventRow extends Record<string, unknown> {
  id: string;
  title: string;
  category: string;
  type: string;
  status: string;
  deadline?: string;
  owner: string;
  suppliers: number;
}

const columns: Column<EventRow>[] = [
  { key: 'id', label: 'ID', sortable: true },
  { key: 'title', label: 'Title', sortable: true },
  {
    key: 'category',
    label: 'Category',
    sortable: true,
    render: (item) => (item.category as string) || <span className="text-gray-400">—</span>,
  },
  {
    key: 'type',
    label: 'Type',
    sortable: true,
    render: (item) => (
      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
        {item.type as string}
      </span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (item) => <StatusBadge status={item.status as string} />,
  },
  {
    key: 'deadline',
    label: 'Deadline',
    sortable: true,
    render: (item) =>
      item.deadline ? formatDate(item.deadline as string) : <span className="text-gray-400">—</span>,
  },
  { key: 'suppliers', label: 'Suppliers', sortable: true },
  { key: 'owner', label: 'Owner', sortable: true },
];

export function EventListPage() {
  const navigate = useNavigate();
  const lookupUser = useUserLookup();
  const { data: events = [], isLoading } = useSourcingEvents();
  // One read of every invitation, counted per event in memory — cheaper than a
  // count query per row, and the register is small.
  const { data: allResponses = [] } = useAllSourcingResponses();
  const [filters, setFilters] = useState<Record<string, string | string[]>>({});

  const rows = useMemo<EventRow[]>(
    () =>
      events.map((e) => ({
        id: e.id,
        title: e.title,
        category: e.category,
        type: e.type,
        status: e.status,
        deadline: e.deadline,
        owner: lookupUser(e.ownerId)?.name ?? 'Unassigned',
        suppliers: allResponses.filter((r) => r.eventId === e.id).length,
      })),
    [events, lookupUser, allResponses],
  );

  // Category options come from the live data, so an event created with a new
  // category is filterable without a code change.
  const filterConfigs: FilterConfig[] = useMemo(
    () => [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { label: 'Draft', value: 'draft' },
          { label: 'Published', value: 'published' },
          { label: 'In Evaluation', value: 'in-evaluation' },
          { label: 'Award Pending', value: 'award-pending' },
          { label: 'Completed', value: 'completed' },
          { label: 'Cancelled', value: 'cancelled' },
        ],
      },
      {
        key: 'type',
        label: 'Type',
        type: 'select',
        options: [
          { label: 'RFI', value: 'RFI' },
          { label: 'RFP', value: 'RFP' },
          { label: 'RFQ', value: 'RFQ' },
        ],
      },
      {
        key: 'category',
        label: 'Category',
        type: 'select',
        options: Array.from(new Set(events.map((e) => e.category).filter(Boolean)))
          .sort()
          .map((c) => ({ label: c, value: c })),
      },
    ],
    [events],
  );

  const filtered = useMemo(() => {
    let result = rows;
    for (const key of ['status', 'type', 'category'] as const) {
      const value = filters[key];
      if (value && typeof value === 'string') {
        result = result.filter((e) => e[key] === value);
      }
    }
    return result;
  }, [rows, filters]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sourcing Events"
        subtitle={isLoading ? 'Loading…' : `${filtered.length} events`}
        actions={
          <Button onClick={() => navigate('/sourcing/new')}>
            <Plus className="size-4" />
            New Event
          </Button>
        }
      />

      <FilterBar
        filters={filterConfigs}
        activeFilters={filters}
        onFilterChange={(key, val) => setFilters((prev) => ({ ...prev, [key]: val }))}
        onClear={() => setFilters({})}
      />

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(item) => navigate(`/sourcing/${item.id}`)}
        searchable
        searchPlaceholder="Search events..."
        emptyMessage={isLoading ? 'Loading events…' : 'No sourcing events found.'}
      />
    </div>
  );
}
