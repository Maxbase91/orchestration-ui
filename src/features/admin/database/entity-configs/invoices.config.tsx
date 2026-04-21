import type { Column } from '@/components/shared/data-table';
import type { Invoice } from '@/data/types';
import type { EntityConfig } from './types';

type InvoiceRow = Invoice & Record<string, unknown>;

const columns: Column<InvoiceRow>[] = [
  { key: 'id', label: 'ID', sortable: true, className: 'font-mono text-xs' },
  { key: 'supplierName', label: 'Supplier', sortable: true },
  {
    key: 'amount',
    label: 'Amount',
    sortable: true,
    render: (i) => `${i.currency} ${i.amount.toLocaleString()}`,
  },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'matchStatus', label: 'Match', sortable: true },
  { key: 'invoiceDate', label: 'Invoice Date', sortable: true },
  { key: 'dueDate', label: 'Due Date', sortable: true },
  { key: 'poId', label: 'PO', className: 'font-mono text-xs' },
];

export const invoicesConfig: EntityConfig<'invoice'> = {
  key: 'invoice',
  columns,
  getId: (i) => i.id,
  getDisplayLabel: (i) => `${i.id} — ${i.supplierName}`,
  defaultNew: () => ({
    id: `INV-${Math.floor(Math.random() * 9000 + 1000)}`,
    supplierId: '',
    supplierName: '',
    amount: 0,
    currency: 'EUR',
    status: 'submitted',
    invoiceDate: '',
    dueDate: '',
    matchStatus: 'unmatched',
  }),
  fields: [
    { key: 'id', label: 'ID', type: 'text', required: true, readOnly: true },
    { key: 'supplierId', label: 'Supplier ID', type: 'text', required: true },
    { key: 'supplierName', label: 'Supplier Name', type: 'text', required: true },
    { key: 'amount', label: 'Amount', type: 'number', required: true, min: 0 },
    { key: 'currency', label: 'Currency', type: 'text', required: true },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      required: true,
      options: [
        { value: 'submitted', label: 'Submitted' },
        { value: 'under-review', label: 'Under review' },
        { value: 'matched', label: 'Matched' },
        { value: 'approved', label: 'Approved' },
        { value: 'scheduled', label: 'Scheduled' },
        { value: 'paid', label: 'Paid' },
        { value: 'disputed', label: 'Disputed' },
      ],
    },
    { key: 'invoiceDate', label: 'Invoice Date', type: 'date', required: true },
    { key: 'dueDate', label: 'Due Date', type: 'date' },
    { key: 'poId', label: 'Linked PO ID', type: 'text' },
    {
      key: 'matchStatus',
      label: 'Match Status',
      type: 'select',
      options: [
        { value: 'matched', label: 'Matched' },
        { value: 'partial-match', label: 'Partial match' },
        { value: 'unmatched', label: 'Unmatched' },
        { value: 'variance', label: 'Variance' },
      ],
    },
    { key: 'matchVariance', label: 'Match Variance', type: 'number' },
    { key: 'paidDate', label: 'Paid Date', type: 'date' },
  ],
  filters: [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'submitted', label: 'Submitted' },
        { value: 'under-review', label: 'Under review' },
        { value: 'matched', label: 'Matched' },
        { value: 'approved', label: 'Approved' },
        { value: 'scheduled', label: 'Scheduled' },
        { value: 'paid', label: 'Paid' },
        { value: 'disputed', label: 'Disputed' },
      ],
      predicate: (i, v) => i.status === v,
    },
  ],
};
