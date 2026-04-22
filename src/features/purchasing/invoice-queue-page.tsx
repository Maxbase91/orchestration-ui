import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { AISuggestionCard } from '@/components/shared/ai-suggestion-card';
import { FilterBar, type FilterConfig } from '@/components/shared/filter-bar';
import { useInvoices } from '@/lib/db/hooks/use-invoices';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Invoice } from '@/data/types';

const filterConfigs: FilterConfig[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { label: 'Submitted', value: 'submitted' },
      { label: 'Under Review', value: 'under-review' },
      { label: 'Matched', value: 'matched' },
      { label: 'Approved', value: 'approved' },
      { label: 'Scheduled', value: 'scheduled' },
      { label: 'Paid', value: 'paid' },
      { label: 'Disputed', value: 'disputed' },
    ],
  },
  {
    key: 'matchStatus',
    label: 'Match Status',
    type: 'select',
    options: [
      { label: 'Matched', value: 'matched' },
      { label: 'Partial Match', value: 'partial-match' },
      { label: 'Unmatched', value: 'unmatched' },
      { label: 'Variance', value: 'variance' },
    ],
  },
];

const columns: Column<Invoice & Record<string, unknown>>[] = [
  { key: 'id', label: 'ID', sortable: true },
  { key: 'supplierName', label: 'Supplier', sortable: true },
  {
    key: 'amount',
    label: 'Amount',
    sortable: true,
    render: (item) => formatCurrency(item.amount as number),
  },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (item) => <StatusBadge status={item.status as string} />,
  },
  {
    key: 'invoiceDate',
    label: 'Invoice Date',
    sortable: true,
    render: (item) => formatDate(item.invoiceDate as string),
  },
  {
    key: 'dueDate',
    label: 'Due Date',
    sortable: true,
    render: (item) => formatDate(item.dueDate as string),
  },
  {
    key: 'matchStatus',
    label: 'Match',
    sortable: true,
    render: (item) => <StatusBadge status={item.matchStatus as string} size="sm" />,
  },
  {
    key: 'poId',
    label: 'PO Ref',
    sortable: true,
    render: (item) => (item.poId as string) || '-',
  },
];

export function InvoiceQueuePage() {
  const { data: invoices = [] } = useInvoices();
  const [filters, setFilters] = useState<Record<string, string | string[]>>({});
  const [showAI, setShowAI] = useState(true);

  const autoMatched = invoices.filter((i) => i.matchStatus === 'matched' && i.status !== 'paid').length;
  const needsReview = invoices.filter((i) => i.matchStatus === 'variance' || i.matchStatus === 'unmatched').length;

  const filtered = useMemo(() => {
    let result = invoices;

    const status = filters.status;
    if (status && typeof status === 'string') {
      result = result.filter((i) => i.status === status);
    }

    const matchStatus = filters.matchStatus;
    if (matchStatus && typeof matchStatus === 'string') {
      result = result.filter((i) => i.matchStatus === matchStatus);
    }

    return result;
  }, [invoices, filters]);

  const tableData = filtered.map((inv) => ({ ...inv } as Invoice & Record<string, unknown>));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Invoice Queue"
        subtitle={`${filtered.length} invoices`}
      />

      {showAI && (
        <AISuggestionCard
          title="Invoice Matching Summary"
          confidence={0.95}
          onDismiss={() => setShowAI(false)}
        >
          <p>
            {autoMatched} invoices auto-matched within tolerance. {needsReview} require manual review
            due to amount variances or missing PO references.
          </p>
        </AISuggestionCard>
      )}

      <FilterBar
        filters={filterConfigs}
        activeFilters={filters}
        onFilterChange={(key, val) => setFilters((prev) => ({ ...prev, [key]: val }))}
        onClear={() => setFilters({})}
      />

      <DataTable
        columns={columns}
        data={tableData}
        searchable
        searchPlaceholder="Search invoices..."
        emptyMessage="No invoices found."
      />
    </div>
  );
}
