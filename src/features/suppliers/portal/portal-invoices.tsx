import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency, formatDate } from '@/lib/format';
import { useInvoiceLookup, useInvoices } from '@/lib/db/hooks/use-invoices';
import type { Invoice } from '@/data/types';

const PORTAL_SUPPLIER_ID = 'SUP-001';

type InvoiceRow = Invoice & Record<string, unknown>;

const invoiceStatuses = ['submitted', 'under-review', 'approved', 'scheduled', 'paid'] as const;

const columns: Column<InvoiceRow>[] = [
  {
    key: 'id',
    label: 'Invoice',
    sortable: true,
    render: (inv) => <span className="font-medium text-gray-900">{inv.id as string}</span>,
  },
  {
    key: 'amount',
    label: 'Amount',
    sortable: true,
    className: 'text-right',
    render: (inv) => (
      <span className="text-sm">{formatCurrency(inv.amount as number, inv.currency as string)}</span>
    ),
  },
  {
    key: 'invoiceDate',
    label: 'Date',
    sortable: true,
    render: (inv) => <span className="text-sm">{formatDate(inv.invoiceDate as string)}</span>,
  },
  {
    key: 'dueDate',
    label: 'Due Date',
    sortable: true,
    render: (inv) => <span className="text-sm">{formatDate(inv.dueDate as string)}</span>,
  },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (inv) => <StatusBadge status={inv.status as string} size="sm" />,
  },
  {
    key: 'paidDate',
    label: 'Paid Date',
    sortable: true,
    render: (inv) => (
      <span className="text-sm">
        {(inv.paidDate as string) ? formatDate(inv.paidDate as string) : '--'}
      </span>
    ),
  },
];

export function PortalInvoices() {
  useInvoices();
  const { bySupplier: invoicesBySupplier } = useInvoiceLookup();
  const invoices = invoicesBySupplier(PORTAL_SUPPLIER_ID);
  const paidInvoices = invoices.filter((inv) => inv.status === 'paid');
  const pendingInvoices = invoices.filter((inv) => inv.status !== 'paid');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Invoices & Payments</h1>
        <Button>
          <Plus className="size-4" />
          Submit Invoice
        </Button>
      </div>

      {/* Status Pipeline */}
      <Card className="py-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Invoice Status Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1">
            {invoiceStatuses.map((status, i) => {
              const count = invoices.filter((inv) => inv.status === status).length;
              return (
                <div key={status} className="flex items-center">
                  <div className="flex flex-col items-center gap-1 px-3 py-2">
                    <span className="text-lg font-semibold text-gray-900">{count}</span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {status.replace('-', ' ')}
                    </span>
                  </div>
                  {i < invoiceStatuses.length - 1 && (
                    <div className="h-px w-8 bg-border" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Pending Invoices */}
      {pendingInvoices.length > 0 && (
        <Card className="py-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pending Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={pendingInvoices as InvoiceRow[]}
              emptyMessage="No pending invoices."
            />
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      <Card className="py-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={paidInvoices as InvoiceRow[]}
            emptyMessage="No payment history available."
          />
        </CardContent>
      </Card>
    </div>
  );
}
