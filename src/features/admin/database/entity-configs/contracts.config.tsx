import type { Column } from '@/components/shared/data-table';
import type { Contract } from '@/data/types';
import type { EntityConfig } from './types';

type ContractRow = Contract & Record<string, unknown>;

const columns: Column<ContractRow>[] = [
  { key: 'id', label: 'ID', sortable: true, className: 'font-mono text-xs' },
  { key: 'title', label: 'Title', sortable: true },
  { key: 'supplierName', label: 'Supplier', sortable: true },
  {
    key: 'value',
    label: 'Value',
    sortable: true,
    render: (c) => `€${c.value.toLocaleString()}`,
  },
  { key: 'startDate', label: 'Start', sortable: true },
  { key: 'endDate', label: 'End', sortable: true },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (c) => (
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
          c.status === 'active'
            ? 'bg-green-100 text-green-700'
            : c.status === 'expiring'
              ? 'bg-amber-100 text-amber-700'
              : c.status === 'expired' || c.status === 'terminated'
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-700'
        }`}
      >
        {c.status}
      </span>
    ),
  },
  {
    key: 'utilisationPercentage',
    label: 'Used',
    sortable: true,
    render: (c) => `${c.utilisationPercentage}%`,
  },
];

export const contractsConfig: EntityConfig<'contract'> = {
  key: 'contract',
  columns,
  getId: (c) => c.id,
  getDisplayLabel: (c) => `${c.id} — ${c.title}`,
  defaultNew: () => ({
    id: `CON-${Math.floor(Math.random() * 9000 + 1000)}`,
    title: '',
    supplierId: '',
    supplierName: '',
    value: 0,
    startDate: '',
    endDate: '',
    status: 'draft',
    ownerId: '',
    ownerName: '',
    department: '',
    category: '',
    utilisationPercentage: 0,
    linkedRequestIds: [],
  }),
  fields: [
    { key: 'id', label: 'ID', type: 'text', required: true, readOnly: true },
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'supplierId', label: 'Supplier ID (SUP-xxx)', type: 'text', required: true },
    { key: 'supplierName', label: 'Supplier Name', type: 'text', required: true },
    { key: 'value', label: 'Value (EUR)', type: 'number', required: true, min: 0 },
    { key: 'startDate', label: 'Start Date', type: 'date', required: true },
    { key: 'endDate', label: 'End Date', type: 'date', required: true },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      required: true,
      options: [
        { value: 'draft', label: 'Draft' },
        { value: 'under-review', label: 'Under review' },
        { value: 'active', label: 'Active' },
        { value: 'expiring', label: 'Expiring' },
        { value: 'expired', label: 'Expired' },
        { value: 'terminated', label: 'Terminated' },
      ],
    },
    { key: 'ownerId', label: 'Owner ID', type: 'text' },
    { key: 'ownerName', label: 'Owner Name', type: 'text' },
    { key: 'department', label: 'Department', type: 'text' },
    { key: 'category', label: 'Category', type: 'text' },
    { key: 'renewalDate', label: 'Renewal Date', type: 'date' },
    { key: 'utilisationPercentage', label: 'Utilisation %', type: 'number', min: 0, max: 100 },
  ],
  filters: [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'draft', label: 'Draft' },
        { value: 'under-review', label: 'Under review' },
        { value: 'active', label: 'Active' },
        { value: 'expiring', label: 'Expiring' },
        { value: 'expired', label: 'Expired' },
        { value: 'terminated', label: 'Terminated' },
      ],
      predicate: (c, v) => c.status === v,
    },
  ],
};
