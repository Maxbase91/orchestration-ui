import type { Column } from '@/components/shared/data-table';
import type { PurchaseOrder } from '@/data/types';
import type { EntityConfig } from './types';

type PORow = PurchaseOrder & Record<string, unknown>;

const columns: Column<PORow>[] = [
  { key: 'id', label: 'ID', sortable: true, className: 'font-mono text-xs' },
  { key: 'supplierName', label: 'Supplier', sortable: true },
  {
    key: 'value',
    label: 'Value',
    sortable: true,
    render: (p) => `€${p.value.toLocaleString()}`,
  },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (p) => (
      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
        {p.status}
      </span>
    ),
  },
  { key: 'createdAt', label: 'Created', sortable: true },
  { key: 'deliveryDate', label: 'Delivery', sortable: true },
  { key: 'contractId', label: 'Contract', className: 'font-mono text-xs' },
  { key: 'requestId', label: 'Request', className: 'font-mono text-xs' },
  {
    key: 'lineItems',
    label: 'Line items',
    render: (p) => <span className="text-xs text-gray-500">{p.lineItems.length}</span>,
  },
];

export const purchaseOrdersConfig: EntityConfig<'purchaseOrder'> = {
  key: 'purchaseOrder',
  columns,
  getId: (p) => p.id,
  getDisplayLabel: (p) => `${p.id} — ${p.supplierName}`,
  defaultNew: () => ({
    id: `PO-${Math.floor(Math.random() * 9000 + 1000)}`,
    supplierId: '',
    supplierName: '',
    value: 0,
    status: 'draft',
    createdAt: new Date().toISOString(),
    deliveryDate: '',
    lineItems: [],
  }),
  fields: [
    { key: 'id', label: 'ID', type: 'text', required: true, readOnly: true },
    { key: 'supplierId', label: 'Supplier ID', type: 'text', required: true },
    { key: 'supplierName', label: 'Supplier Name', type: 'text', required: true },
    { key: 'value', label: 'Value (EUR)', type: 'number', required: true, min: 0 },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      required: true,
      options: [
        { value: 'draft', label: 'Draft' },
        { value: 'submitted', label: 'Submitted' },
        { value: 'acknowledged', label: 'Acknowledged' },
        { value: 'received', label: 'Received' },
        { value: 'partially-received', label: 'Partially received' },
        { value: 'closed', label: 'Closed' },
      ],
    },
    { key: 'createdAt', label: 'Created At (ISO)', type: 'text' },
    { key: 'deliveryDate', label: 'Delivery Date', type: 'date' },
    { key: 'contractId', label: 'Linked Contract ID', type: 'text' },
    { key: 'requestId', label: 'Originating Request ID', type: 'text' },
  ],
  filters: [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'draft', label: 'Draft' },
        { value: 'submitted', label: 'Submitted' },
        { value: 'acknowledged', label: 'Acknowledged' },
        { value: 'received', label: 'Received' },
        { value: 'partially-received', label: 'Partially received' },
        { value: 'closed', label: 'Closed' },
      ],
      predicate: (p, v) => p.status === v,
    },
  ],
  renderComplexFields: ({ record }) => (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Line items ({record.lineItems.length})
      </h4>
      <div className="rounded-md border border-gray-100 bg-gray-50 p-3 text-xs text-gray-700">
        {record.lineItems.length === 0 ? (
          <p className="italic text-muted-foreground">No line items.</p>
        ) : (
          <ul className="space-y-1">
            {record.lineItems.map((li, idx) => (
              <li key={idx} className="flex justify-between gap-3">
                <span>
                  {li.description} — {li.quantity} × €{li.unitPrice.toLocaleString()}
                </span>
                <span className="text-muted-foreground">
                  {li.received}/{li.quantity} received
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] italic text-muted-foreground">
          Line items are read-only in this view. Edit via the PO detail page.
        </p>
      </div>
    </div>
  ),
};
