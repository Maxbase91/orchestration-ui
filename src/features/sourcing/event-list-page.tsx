import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { FilterBar, type FilterConfig } from '@/components/shared/filter-bar';
import { formatDate } from '@/lib/format';

type EventStatus = 'draft' | 'published' | 'in-evaluation' | 'award-pending' | 'completed' | 'cancelled';
type EventType = 'RFI' | 'RFP' | 'RFQ';

interface SourcingEvent {
  id: string;
  title: string;
  category: string;
  type: EventType;
  status: EventStatus;
  supplierCount: number;
  deadline: string;
  owner: string;
}

const mockEvents: SourcingEvent[] = [
  {
    id: 'SRC-001',
    title: 'IT Consulting Framework 2025-2027',
    category: 'IT Consulting',
    type: 'RFP',
    status: 'in-evaluation',
    supplierCount: 6,
    deadline: '2025-03-15',
    owner: 'Marcus Johnson',
  },
  {
    id: 'SRC-002',
    title: 'Cloud Infrastructure Services',
    category: 'Cloud Services',
    type: 'RFQ',
    status: 'published',
    supplierCount: 4,
    deadline: '2025-04-01',
    owner: 'Sarah Chen',
  },
  {
    id: 'SRC-003',
    title: 'Office Furniture Renewal',
    category: 'Facilities',
    type: 'RFQ',
    status: 'award-pending',
    supplierCount: 3,
    deadline: '2025-02-28',
    owner: 'Anna Muller',
  },
  {
    id: 'SRC-004',
    title: 'Cybersecurity Assessment Services',
    category: 'Security',
    type: 'RFP',
    status: 'draft',
    supplierCount: 0,
    deadline: '2025-05-01',
    owner: 'Marcus Johnson',
  },
  {
    id: 'SRC-005',
    title: 'Market Research - AI/ML Landscape',
    category: 'Research',
    type: 'RFI',
    status: 'completed',
    supplierCount: 8,
    deadline: '2025-01-31',
    owner: 'Sarah Chen',
  },
  {
    id: 'SRC-006',
    title: 'Managed Print Services',
    category: 'Facilities',
    type: 'RFP',
    status: 'cancelled',
    supplierCount: 2,
    deadline: '2025-02-15',
    owner: 'Anna Muller',
  },
];

const filterConfigs: FilterConfig[] = [
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
    options: Array.from(new Set(mockEvents.map((e) => e.category)))
      .sort()
      .map((c) => ({ label: c, value: c })),
  },
];

const columns: Column<SourcingEvent & Record<string, unknown>>[] = [
  { key: 'id', label: 'ID', sortable: true },
  { key: 'title', label: 'Title', sortable: true },
  { key: 'category', label: 'Category', sortable: true },
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
  { key: 'supplierCount', label: 'Suppliers', sortable: true },
  {
    key: 'deadline',
    label: 'Deadline',
    sortable: true,
    render: (item) => formatDate(item.deadline as string),
  },
  { key: 'owner', label: 'Owner', sortable: true },
];

export function EventListPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Record<string, string | string[]>>({});

  const filtered = useMemo(() => {
    let result = mockEvents;

    const status = filters.status;
    if (status && typeof status === 'string') {
      result = result.filter((e) => e.status === status);
    }

    const type = filters.type;
    if (type && typeof type === 'string') {
      result = result.filter((e) => e.type === type);
    }

    const category = filters.category;
    if (category && typeof category === 'string') {
      result = result.filter((e) => e.category === category);
    }

    return result;
  }, [filters]);

  const tableData = filtered.map((e) => ({ ...e } as SourcingEvent & Record<string, unknown>));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sourcing Events"
        subtitle={`${filtered.length} events`}
        actions={
          <Button>
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
        data={tableData}
        onRowClick={(item) => navigate(`/sourcing/${item.id}`)}
        searchable
        searchPlaceholder="Search events..."
        emptyMessage="No sourcing events found."
      />
    </div>
  );
}
