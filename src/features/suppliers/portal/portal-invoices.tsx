import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency, formatDate } from '@/lib/format';
import { useInvoiceLookup, useInvoices, useCreateInvoice } from '@/lib/db/hooks/use-invoices';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Invoice } from '@/data/types';
import { toast } from 'sonner';

const PORTAL_SUPPLIER_ID = 'SUP-001';
const PORTAL_SUPPLIER_NAME = 'Accenture';

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

interface SubmitForm {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: string;
  poId: string;
}

const EMPTY_FORM: SubmitForm = {
  invoiceNumber: '',
  invoiceDate: '',
  dueDate: '',
  amount: '',
  poId: '',
};

export function PortalInvoices() {
  useInvoices();
  const { bySupplier: invoicesBySupplier } = useInvoiceLookup();
  const createInvoice = useCreateInvoice();
  const invoices = invoicesBySupplier(PORTAL_SUPPLIER_ID);
  const paidInvoices = invoices.filter((inv) => inv.status === 'paid');
  const pendingInvoices = invoices.filter((inv) => inv.status !== 'paid');

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<SubmitForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field: keyof SubmitForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.invoiceNumber || !form.invoiceDate || !form.dueDate || !form.amount) {
      toast.error('Please fill in all required fields.');
      return;
    }
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Amount must be a positive number.');
      return;
    }
    setSubmitting(true);
    try {
      await createInvoice.mutateAsync({
        id: form.invoiceNumber,
        supplierId: PORTAL_SUPPLIER_ID,
        supplierName: PORTAL_SUPPLIER_NAME,
        amount,
        currency: 'EUR',
        status: 'submitted',
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate,
        poId: form.poId || undefined,
        matchStatus: 'unmatched',
      });
      toast.success(`Invoice ${form.invoiceNumber} submitted successfully.`);
      setForm(EMPTY_FORM);
      setOpen(false);
    } catch (e) {
      console.error('Failed to submit invoice:', e);
      toast.error('Failed to submit invoice. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Invoices & Payments</h1>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          Submit Invoice
        </Button>
      </div>

      {/* Submit Invoice Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="inv-number">Invoice Number *</Label>
              <Input id="inv-number" placeholder="e.g. INV-2026-001" value={form.invoiceNumber} onChange={handleChange('invoiceNumber')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="inv-date">Invoice Date *</Label>
                <Input id="inv-date" type="date" value={form.invoiceDate} onChange={handleChange('invoiceDate')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="due-date">Due Date *</Label>
                <Input id="due-date" type="date" value={form.dueDate} onChange={handleChange('dueDate')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount (EUR) *</Label>
              <Input id="amount" type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={handleChange('amount')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="po-id">Purchase Order Reference</Label>
              <Input id="po-id" placeholder="e.g. PO-001 (optional)" value={form.poId} onChange={handleChange('poId')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
