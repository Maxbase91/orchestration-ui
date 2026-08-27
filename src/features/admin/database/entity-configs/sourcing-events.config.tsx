// Database admin config for sourcing events: table columns, edit form fields,
// and status/type filters.
//
// Requirements and criteria are nested arrays the generic form cannot edit, so
// they are shown read-only via renderComplexFields — the New Event wizard owns
// them, and it is the only place that enforces criteria weights totalling 100.
// Editing them here would let an admin create an event that cannot be scored.

import type { Column } from '@/components/shared/data-table';
import type { EntityConfig } from './types';
import type { SourcingEvent } from '@/lib/db/sourcing-events';
import { criteriaWeightTotal } from '@/lib/procurement/sourcing-award';

type EventRow = SourcingEvent & Record<string, unknown>;

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'in-evaluation', label: 'In Evaluation' },
  { value: 'award-pending', label: 'Award Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const TYPE_OPTIONS = [
  { value: 'RFI', label: 'RFI' },
  { value: 'RFP', label: 'RFP' },
  { value: 'RFQ', label: 'RFQ' },
];

const columns: Column<EventRow>[] = [
  { key: 'id', label: 'ID', sortable: true, className: 'font-mono text-xs' },
  { key: 'title', label: 'Title', sortable: true },
  { key: 'type', label: 'Type', sortable: true },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (e) => (
      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
        {e.status}
      </span>
    ),
  },
  { key: 'category', label: 'Category', sortable: true },
  {
    key: 'budget',
    label: 'Budget',
    sortable: true,
    render: (e) => (e.budget != null ? `€${e.budget.toLocaleString()}` : '—'),
  },
  { key: 'deadline', label: 'Deadline', sortable: true },
  { key: 'requestId', label: 'Request', className: 'font-mono text-xs' },
  { key: 'awardedSupplierId', label: 'Awarded to', className: 'font-mono text-xs' },
];

export const sourcingEventsConfig: EntityConfig<'sourcingEvent'> = {
  key: 'sourcingEvent',
  columns,
  getId: (e) => e.id,
  getDisplayLabel: (e) => `${e.id} — ${e.title}`,
  defaultNew: () => ({
    // Not minted from next_sourcing_event_id(): defaultNew is synchronous, and
    // the sequence is only reachable over the network. An admin-created row is
    // the exception, not the path events normally arrive by.
    id: `SRC-ADM-${Math.floor(Math.random() * 9000 + 1000)}`,
    title: '',
    category: '',
    type: 'RFP',
    status: 'draft',
    description: '',
    currency: 'EUR',
    requirements: [],
    criteria: [],
  }),
  fields: [
    { key: 'id', label: 'ID', type: 'text', required: true, readOnly: true },
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'category', label: 'Category', type: 'text' },
    { key: 'type', label: 'Type', type: 'select', required: true, options: TYPE_OPTIONS },
    { key: 'status', label: 'Status', type: 'select', required: true, options: STATUS_OPTIONS },
    { key: 'budget', label: 'Budget (max)', type: 'number', min: 0 },
    { key: 'budgetMin', label: 'Budget (min)', type: 'number', min: 0 },
    { key: 'currency', label: 'Currency', type: 'text' },
    { key: 'startDate', label: 'Start Date', type: 'date' },
    { key: 'deadline', label: 'Deadline', type: 'date' },
    { key: 'publishDate', label: 'Published', type: 'date' },
    { key: 'evaluationDate', label: 'Evaluation', type: 'date' },
    { key: 'awardDate', label: 'Award Date', type: 'date' },
    { key: 'ownerId', label: 'Owner ID', type: 'text' },
    {
      key: 'requestId',
      label: 'Request ID',
      type: 'text',
      helpText: 'The demand this event was raised from. Empty for a standing category event.',
    },
    {
      key: 'awardedSupplierId',
      label: 'Awarded Supplier ID',
      type: 'text',
      helpText:
        'Set by the award action. Clearing it here does NOT reopen the event or undo the ' +
        'supplier written onto the request.',
    },
  ],
  filters: [
    {
      key: 'status',
      label: 'Status',
      options: STATUS_OPTIONS,
      predicate: (e, value) => e.status === value,
    },
    {
      key: 'type',
      label: 'Type',
      options: TYPE_OPTIONS,
      predicate: (e, value) => e.type === value,
    },
  ],
  renderComplexFields: ({ record }) => (
    <div className="space-y-3 text-sm">
      <div>
        <p className="mb-1 font-medium">Requirements ({record.requirements.length})</p>
        {record.requirements.length === 0 ? (
          <p className="text-xs text-gray-500">None captured.</p>
        ) : (
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-gray-600">
            {record.requirements.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="mb-1 font-medium">
          Evaluation criteria ({record.criteria.length}
          {record.criteria.length > 0 && ` · ${criteriaWeightTotal(record.criteria)}% total`})
        </p>
        {record.criteria.length === 0 ? (
          <p className="text-xs text-gray-500">
            None — responses to this event cannot be scored.
          </p>
        ) : (
          <ul className="space-y-0.5 text-xs text-gray-600">
            {record.criteria.map((c) => (
              <li key={c.id}>
                {c.label} — {c.weight}%
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-gray-500">
        Both are set by the New Event wizard, which is the only place criteria weights are
        validated. Deleting an event also deletes its invitations and submitted bids.
      </p>
    </div>
  ),
};
