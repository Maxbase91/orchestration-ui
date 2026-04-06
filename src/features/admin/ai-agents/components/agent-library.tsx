import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { DataTable, type Column } from '@/components/shared/data-table';
import { formatDate } from '@/lib/format';
import type { AIAgent } from '@/data/types';

const TYPE_LABELS: Record<string, string> = {
  classification: 'Classification',
  validation: 'Validation',
  extraction: 'Extraction',
  recommendation: 'Recommendation',
  'knowledge-base': 'Knowledge Base',
  'anomaly-detection': 'Anomaly Detection',
};

const TYPE_COLORS: Record<string, string> = {
  classification: 'bg-purple-100 text-purple-700',
  validation: 'bg-blue-100 text-blue-700',
  extraction: 'bg-emerald-100 text-emerald-700',
  recommendation: 'bg-amber-100 text-amber-700',
  'knowledge-base': 'bg-cyan-100 text-cyan-700',
  'anomaly-detection': 'bg-red-100 text-red-700',
};

interface AgentLibraryProps {
  agents: AIAgent[];
  onSelectAgent: (agent: AIAgent) => void;
  onAddAgent: () => void;
}

export function AgentLibrary({ agents, onSelectAgent, onAddAgent }: AgentLibraryProps) {
  const columns: Column<AIAgent & Record<string, unknown>>[] = [
    {
      key: 'name',
      label: 'Agent Name',
      sortable: true,
      render: (agent) => (
        <span className="font-medium text-gray-900">{agent.name}</span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      render: (agent) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[agent.type as string] ?? 'bg-gray-100 text-gray-700'}`}>
          {TYPE_LABELS[agent.type as string] ?? agent.type}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (agent) => <StatusBadge status={agent.status as string} size="sm" />,
    },
    {
      key: 'accuracy',
      label: 'Accuracy',
      sortable: true,
      render: (agent) => (
        <span className="text-sm font-medium text-gray-900">{agent.accuracy as number}%</span>
      ),
    },
    {
      key: 'decisionsMade',
      label: 'Decisions',
      sortable: true,
      render: (agent) => (
        <span className="text-sm text-gray-600">{(agent.decisionsMade as number).toLocaleString()}</span>
      ),
    },
    {
      key: 'lastUpdated',
      label: 'Last Updated',
      sortable: true,
      render: (agent) => (
        <span className="text-sm text-gray-500">{formatDate(agent.lastUpdated as string)}</span>
      ),
    },
  ];

  const tableData = agents.map((a) => ({ ...a } as AIAgent & Record<string, unknown>));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Agent Library</h2>
          <p className="text-xs text-gray-500">{agents.length} agents configured</p>
        </div>
        <Button size="sm" onClick={onAddAgent}>
          <Plus className="size-3.5" />
          Add Agent
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={tableData}
        onRowClick={(item) => onSelectAgent(item as unknown as AIAgent)}
        searchable
        searchPlaceholder="Search agents..."
      />
    </div>
  );
}
