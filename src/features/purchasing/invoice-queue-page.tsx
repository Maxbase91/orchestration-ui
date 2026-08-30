// Invoice queue page: all supplier invoices with lifecycle and match-status
// filters, plus a matching summary card that flags what needs manual review.
// Read-only in R1 — variances are resolved via the three-way match page.
import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { AISuggestionCard } from '@/components/shared/ai-suggestion-card';
import { FilterBar, type FilterConfig } from '@/components/shared/filter-bar';
import { useInvoices } from '@/lib/db/hooks/use-invoices';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Invoice } from '@/data/types';
import { useUpdateInvoice } from '@/lib/db/hooks/use-invoices';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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
  const updateInvoice = useUpdateInvoice();
  const currentRole = useAuthStore((state) => state.currentRole);
  const [filters, setFilters] = useState<Record<string, string | string[]>>({});
  const [showAI, setShowAI] = useState(true);

  // Summary counts: paid invoices are done, so only unpaid matches count as
  // "auto-matched"; variance/unmatched are the two states needing a human.
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
  const canOperate = ['operations-lead', 'procurement-manager', 'admin'].includes(currentRole);
  const transition = async (invoice: Invoice, patch: Partial<Invoice>, message: string) => {
    try {
      await updateInvoice.mutateAsync({ id: invoice.id, patch });
      toast.success(message);
    } catch (error) {
      toast.error(`Could not update invoice: ${error instanceof Error ? error.message : 'Please try again.'}`);
    }
  };

  const actionColumn: Column<Invoice & Record<string, unknown>> = {
    key: 'actions', label: 'Action', render: (item) => {
      const invoice = item as Invoice;
      if (!canOperate) return <span className="text-xs text-muted-foreground">View only</span>;
      if (currentRole === 'operations-lead' && invoice.status === 'submitted') return <Button size="sm" variant="outline" onClick={() => void transition(invoice, { status: 'under-review' }, `${invoice.id} is under review`)}>Review</Button>;
      if (currentRole === 'operations-lead' && ['under-review', 'disputed'].includes(invoice.status)) return <div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => void transition(invoice, { status: 'matched', matchStatus: 'matched' }, `${invoice.id} matched`)}>Match</Button><Button size="sm" variant="ghost" onClick={() => void transition(invoice, { status: 'disputed', matchStatus: 'variance' }, `${invoice.id} marked as variance`)}>Variance</Button></div>;
      if (currentRole === 'procurement-manager' && invoice.status === 'matched') return <Button size="sm" onClick={() => void transition(invoice, { status: 'approved' }, `${invoice.id} approved`)}>Approve</Button>;
      if (currentRole === 'admin' && invoice.status === 'approved') return <Button size="sm" onClick={() => void transition(invoice, { status: 'scheduled' }, `${invoice.id} scheduled`)}>Schedule</Button>;
      if (currentRole === 'admin' && invoice.status === 'scheduled') return <Button size="sm" onClick={() => void transition(invoice, { status: 'paid', paidDate: new Date().toISOString().slice(0, 10) }, `${invoice.id} marked paid`)}>Release payment</Button>;
      return <span className="text-xs text-muted-foreground">No action</span>;
    },
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Invoice Queue"
        subtitle={`${filtered.length} invoices`}
      />

      {showAI && (
        <AISuggestionCard
          title="Invoice Matching Summary"
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
        columns={canOperate ? [...columns, actionColumn] : columns}
        data={tableData}
        searchable
        searchPlaceholder="Search invoices..."
        emptyMessage="No invoices found."
      />
    </div>
  );
}
