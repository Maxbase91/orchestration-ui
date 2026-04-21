import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { FilterBar, type FilterConfig } from '@/components/shared/filter-bar';
import { useContracts } from '@/lib/db/hooks/use-contracts';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Contract } from '@/data/types';

type TabFilter = 'all' | 'active' | 'expiring' | 'expired';

const tabs: { id: TabFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'expiring', label: 'Expiring' },
  { id: 'expired', label: 'Expired' },
];

function buildFilterConfigs(allContracts: Contract[]): FilterConfig[] {
  return [
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Under Review', value: 'under-review' },
        { label: 'Active', value: 'active' },
        { label: 'Expiring', value: 'expiring' },
        { label: 'Expired', value: 'expired' },
        { label: 'Terminated', value: 'terminated' },
      ],
    },
    {
      key: 'supplier',
      label: 'Supplier',
      type: 'select',
      options: Array.from(new Set(allContracts.map((c) => c.supplierName)))
        .sort()
        .map((s) => ({ label: s, value: s })),
    },
    {
      key: 'category',
      label: 'Category',
      type: 'select',
      options: Array.from(new Set(allContracts.map((c) => c.category)))
        .sort()
        .map((c) => ({ label: c, value: c })),
    },
  ];
}

function daysUntilExpiry(endDate: string): number {
  const end = new Date(endDate);
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function expiryBadge(endDate: string, status: string) {
  if (status === 'expired' || status === 'terminated' || status === 'draft') return null;
  const days = daysUntilExpiry(endDate);
  if (days <= 0) return null;
  if (days <= 30) return <span className="ml-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">{days}d</span>;
  if (days <= 60) return <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">{days}d</span>;
  if (days <= 90) return <span className="ml-1 rounded-full bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700">{days}d</span>;
  return null;
}

const columns: Column<Contract & Record<string, unknown>>[] = [
  { key: 'id', label: 'ID', sortable: true },
  {
    key: 'title',
    label: 'Title',
    sortable: true,
    render: (item) => (
      <div className="flex items-center">
        <span className="font-medium">{item.title as string}</span>
        {expiryBadge(item.endDate as string, item.status as string)}
      </div>
    ),
  },
  { key: 'supplierName', label: 'Supplier', sortable: true },
  {
    key: 'value',
    label: 'Value',
    sortable: true,
    render: (item) => formatCurrency(item.value as number),
  },
  {
    key: 'startDate',
    label: 'Start Date',
    sortable: true,
    render: (item) => formatDate(item.startDate as string),
  },
  {
    key: 'endDate',
    label: 'End Date',
    sortable: true,
    render: (item) => formatDate(item.endDate as string),
  },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (item) => <StatusBadge status={item.status as string} />,
  },
  { key: 'ownerName', label: 'Owner', sortable: true },
  {
    key: 'renewalDate',
    label: 'Renewal',
    sortable: true,
    render: (item) => (item.renewalDate ? formatDate(item.renewalDate as string) : '-'),
  },
];

export function ContractRegisterPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabFilter>('all');
  const [filters, setFilters] = useState<Record<string, string | string[]>>({});
  const { data: allContracts = [] } = useContracts();

  const filterConfigs = useMemo(() => buildFilterConfigs(allContracts), [allContracts]);

  const filtered = useMemo(() => {
    let result: Contract[] = allContracts;

    if (tab === 'active') result = result.filter((c) => c.status === 'active');
    else if (tab === 'expiring') result = result.filter((c) => c.status === 'expiring');
    else if (tab === 'expired') result = result.filter((c) => c.status === 'expired');

    const status = filters.status;
    if (status && typeof status === 'string') {
      result = result.filter((c) => c.status === status);
    }

    const supplier = filters.supplier;
    if (supplier && typeof supplier === 'string') {
      result = result.filter((c) => c.supplierName === supplier);
    }

    const category = filters.category;
    if (category && typeof category === 'string') {
      result = result.filter((c) => c.category === category);
    }

    return result;
  }, [allContracts, tab, filters]);

  const tableData = filtered.map((c) => ({ ...c } as Contract & Record<string, unknown>));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contract Register"
        subtitle={`${filtered.length} contracts`}
      />

      <div className="flex items-center gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-muted-foreground hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <FilterBar
        filters={filterConfigs}
        activeFilters={filters}
        onFilterChange={(key, val) => setFilters((prev) => ({ ...prev, [key]: val }))}
        onClear={() => setFilters({})}
      />

      <DataTable
        columns={columns}
        data={tableData}
        onRowClick={(item) => navigate(`/contracts/${item.id}`)}
        searchable
        searchPlaceholder="Search contracts..."
        emptyMessage="No contracts found."
      />
    </div>
  );
}
