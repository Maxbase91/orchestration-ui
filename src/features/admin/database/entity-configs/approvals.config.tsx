import type { Column } from '@/components/shared/data-table';
import type { ApprovalEntry } from '@/data/types';
import type { EntityConfig } from './types';

type ApprovalRow = ApprovalEntry & Record<string, unknown>;

const columns: Column<ApprovalRow>[] = [
  { key: 'id', label: 'ID', sortable: true, className: 'font-mono text-xs' },
  { key: 'requestId', label: 'Request', sortable: true, className: 'font-mono text-xs' },
  { key: 'approverName', label: 'Approver', sortable: true },
  { key: 'approverRole', label: 'Role', sortable: true },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (a) => (
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
          a.status === 'approved'
            ? 'bg-green-100 text-green-700'
            : a.status === 'rejected'
              ? 'bg-red-100 text-red-700'
              : a.status === 'delegated'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-amber-100 text-amber-700'
        }`}
      >
        {a.status}
      </span>
    ),
  },
  { key: 'requestedAt', label: 'Requested', sortable: true },
  { key: 'respondedAt', label: 'Responded', sortable: true },
];

export const approvalsConfig: EntityConfig<'approval'> = {
  key: 'approval',
  columns,
  getId: (a) => a.id,
  getDisplayLabel: (a) => `${a.id} — ${a.approverName} (${a.status})`,
  defaultNew: () => ({
    id: `APR-${Math.floor(Math.random() * 9000 + 1000)}`,
    requestId: '',
    approverId: '',
    approverName: '',
    approverRole: '',
    status: 'pending',
    requestedAt: new Date().toISOString(),
  }),
  fields: [
    { key: 'id', label: 'ID', type: 'text', required: true, readOnly: true },
    { key: 'requestId', label: 'Request ID', type: 'text', required: true },
    { key: 'approverId', label: 'Approver User ID', type: 'text', required: true },
    { key: 'approverName', label: 'Approver Name', type: 'text', required: true },
    { key: 'approverRole', label: 'Approver Role', type: 'text' },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      required: true,
      options: [
        { value: 'pending', label: 'Pending' },
        { value: 'approved', label: 'Approved' },
        { value: 'rejected', label: 'Rejected' },
        { value: 'delegated', label: 'Delegated' },
        { value: 'info-requested', label: 'Info Requested' },
      ],
    },
    { key: 'requestedAt', label: 'Requested At (ISO)', type: 'text' },
    { key: 'respondedAt', label: 'Responded At (ISO)', type: 'text' },
    { key: 'comments', label: 'Comments', type: 'textarea' },
    { key: 'delegatedTo', label: 'Delegated To (User ID)', type: 'text' },
  ],
  filters: [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'pending', label: 'Pending' },
        { value: 'approved', label: 'Approved' },
        { value: 'rejected', label: 'Rejected' },
        { value: 'delegated', label: 'Delegated' },
        { value: 'info-requested', label: 'Info Requested' },
      ],
      predicate: (a, v) => a.status === v,
    },
  ],
};
