import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { KPICard } from '@/components/shared/kpi-card';
import { DataTable, type Column } from '@/components/shared/data-table';
import { invoices } from '@/data/invoices';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, Circle } from 'lucide-react';

interface InvoiceRow extends Record<string, unknown> {
  id: string;
  supplierName: string;
  amount: number;
  matchStatus: string;
  approvalStatus: string;
  paymentStatus: string;
  scheduledDate: string;
  paidDate: string;
  status: string;
}

const PAYMENT_STEPS = ['Matched', 'Approved', 'Scheduled', 'Paid'];

function getPaymentStep(status: string): number {
  switch (status) {
    case 'paid': return 4;
    case 'scheduled': return 3;
    case 'approved': return 2;
    case 'matched': return 1;
    default: return 0;
  }
}

function PaymentStepper({ status }: { status: string }) {
  const currentStep = getPaymentStep(status);

  return (
    <div className="flex items-center gap-0.5">
      {PAYMENT_STEPS.map((step, idx) => {
        const stepNum = idx + 1;
        const isComplete = currentStep >= stepNum;
        const isCurrent = currentStep === stepNum;
        return (
          <div key={step} className="flex items-center gap-0.5">
            <div className={cn(
              'flex items-center justify-center rounded-full',
              isComplete ? 'bg-green-100' : isCurrent ? 'bg-blue-100' : 'bg-gray-100',
            )}>
              {isComplete ? (
                <Check className={cn('size-3.5 p-0.5', 'text-green-600')} />
              ) : (
                <Circle className={cn('size-3.5 p-0.5', isCurrent ? 'text-blue-500' : 'text-gray-400')} />
              )}
            </div>
            {idx < PAYMENT_STEPS.length - 1 && (
              <div className={cn(
                'w-3 h-0.5',
                isComplete ? 'bg-green-400' : 'bg-gray-200',
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PaymentTrackerPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const rows = useMemo<InvoiceRow[]>(() => {
    return invoices.map((inv) => {
      const matchLabel = inv.matchStatus.replace('-', ' ');
      const approvalLabel = ['approved', 'scheduled', 'paid'].includes(inv.status) ? 'Approved' :
        inv.status === 'under-review' ? 'Under Review' :
        inv.status === 'disputed' ? 'Disputed' : 'Pending';
      const paymentLabel = inv.status === 'paid' ? 'Paid' :
        inv.status === 'scheduled' ? 'Scheduled' : 'Pending';

      return {
        id: inv.id,
        supplierName: inv.supplierName,
        amount: inv.amount,
        matchStatus: matchLabel,
        approvalStatus: approvalLabel,
        paymentStatus: paymentLabel,
        scheduledDate: inv.dueDate,
        paidDate: inv.paidDate ?? '',
        status: inv.status,
      };
    });
  }, []);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return rows;
    return rows.filter((r) => r.status === statusFilter);
  }, [rows, statusFilter]);

  const totalPending = invoices
    .filter((i) => !['paid', 'disputed'].includes(i.status))
    .reduce((sum, i) => sum + i.amount, 0);

  const scheduledThisWeek = invoices
    .filter((i) => i.status === 'scheduled')
    .reduce((sum, i) => sum + i.amount, 0);

  const paidThisMonth = invoices
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + i.amount, 0);

  const matchColors: Record<string, string> = {
    matched: 'bg-green-100 text-green-700',
    'partial match': 'bg-amber-100 text-amber-700',
    unmatched: 'bg-red-100 text-red-700',
    variance: 'bg-orange-100 text-orange-700',
  };

  const columns: Column<InvoiceRow>[] = [
    {
      key: 'id',
      label: 'Invoice ID',
      sortable: true,
      render: (row) => <span className="font-mono text-xs">{row.id as string}</span>,
    },
    {
      key: 'supplierName',
      label: 'Supplier',
      sortable: true,
      render: (row) => <span className="text-sm font-medium">{row.supplierName as string}</span>,
    },
    {
      key: 'amount',
      label: 'Amount',
      sortable: true,
      render: (row) => <span className="text-sm">{formatCurrency(row.amount as number)}</span>,
    },
    {
      key: 'matchStatus',
      label: 'Match Status',
      render: (row) => (
        <span className={cn(
          'inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize',
          matchColors[row.matchStatus as string] ?? 'bg-gray-100 text-gray-700',
        )}>
          {row.matchStatus as string}
        </span>
      ),
    },
    {
      key: 'approvalStatus',
      label: 'Approval',
      render: (row) => <span className="text-xs">{row.approvalStatus as string}</span>,
    },
    {
      key: 'paymentStatus',
      label: 'Payment',
      render: (row) => <span className="text-xs">{row.paymentStatus as string}</span>,
    },
    {
      key: 'progress',
      label: 'Progress',
      render: (row) => <PaymentStepper status={row.status as string} />,
    },
    {
      key: 'scheduledDate',
      label: 'Due Date',
      sortable: true,
      render: (row) => <span className="text-xs">{formatDate(row.scheduledDate as string)}</span>,
    },
    {
      key: 'paidDate',
      label: 'Paid Date',
      sortable: true,
      render: (row) => {
        const val = row.paidDate as string;
        return val ? <span className="text-xs">{formatDate(val)}</span> : <span className="text-xs text-muted-foreground">--</span>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Tracker"
        subtitle="Track invoice payments from matching to settlement"
        actions={
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="under-review">Under Review</SelectItem>
              <SelectItem value="matched">Matched</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="disputed">Disputed</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KPICard label="Total Pending" value={totalPending} format="currency" />
        <KPICard label="Scheduled This Week" value={scheduledThisWeek} format="currency" />
        <KPICard label="Paid This Month" value={paidThisMonth} format="currency" />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchable
        searchPlaceholder="Search invoices..."
        emptyMessage="No invoices match the current filter."
      />
    </div>
  );
}
