import type { Column } from '@/components/shared/data-table';
import type { WorkflowTemplate } from '@/data/types';
import type { EntityConfig } from './types';

type WorkflowRow = WorkflowTemplate & Record<string, unknown>;

const columns: Column<WorkflowRow>[] = [
  { key: 'id', label: 'ID', sortable: true, className: 'font-mono text-xs' },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'type', label: 'Type', sortable: true },
  {
    key: 'nodes',
    label: 'Nodes',
    render: (w) => <span className="text-xs text-gray-500">{w.nodes.length}</span>,
  },
  {
    key: 'edges',
    label: 'Edges',
    render: (w) => <span className="text-xs text-gray-500">{w.edges.length}</span>,
  },
  { key: 'description', label: 'Description' },
];

export const workflowsConfig: EntityConfig<'workflow'> = {
  key: 'workflow',
  columns,
  getId: (w) => w.id,
  getDisplayLabel: (w) => `${w.id} — ${w.name}`,
  defaultNew: () => ({
    id: `WF-${Math.floor(Math.random() * 9000 + 1000)}`,
    name: '',
    description: '',
    type: '',
    nodes: [],
    edges: [],
  }),
  fields: [
    { key: 'id', label: 'ID', type: 'text', required: true, readOnly: true },
    { key: 'name', label: 'Name', type: 'text', required: true, readOnly: true },
    { key: 'type', label: 'Type', type: 'text', readOnly: true },
    { key: 'description', label: 'Description', type: 'textarea', readOnly: true },
  ],
  readOnlyReason: 'Workflow graphs are editable only in the Workflow Designer.',
  renderComplexFields: ({ record }) => (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        Graph summary
      </h4>
      <div className="rounded-md border border-gray-100 bg-gray-50 p-3 text-xs text-gray-700">
        <p>
          <strong>{record.nodes.length}</strong> nodes, <strong>{record.edges.length}</strong> edges.
        </p>
        <p className="mt-2 text-[11px] italic text-muted-foreground">
          Open the Workflow Designer to edit the graph.
        </p>
        <a
          href="/admin/workflows"
          className="mt-2 inline-block rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
        >
          Edit in Designer →
        </a>
      </div>
    </div>
  ),
};
