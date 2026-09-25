import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { DataTable, type Column } from '@/components/shared/data-table';
import { formatDate } from '@/lib/format';
import type { AIAgent } from '@/data/types';

// Where each agent's status changes what the product does — kept beside the
// code that reads it (test:ai-agents flips each one and watches the effect).
// There were "Accuracy" and "Decisions" columns here: seeded numbers (94.2%,
// 1,247) that nothing measured or updated.
const AGENT_AFFECTS: Record<string, string[]> = {
  // Describe step only: the Home box's catalogue check stopped asking the
  // model (2026-09-25) — the deterministic intake decision decides it.
  'AI-001': ['Describe step: classification'],
  'AI-002': ['Review step: policy checks'],
  'AI-004': ['Analytics: spend anomalies'],
  'AI-005': ['Details step: supplier recommendations'],
  'AI-007': ['Home box and assistant: status answers'],
};

const TYPE_LABELS: Record<string, string> = {
  classification: 'Classification',
  validation: 'Validation',
  extraction: 'Extraction',
  recommendation: 'Recommendation',
  'knowledge-base': 'Knowledge Base',
  'anomaly-detection': 'Anomaly Detection',
  status: 'Status Answers',
};

const TYPE_COLORS: Record<string, string> = {
  classification: 'bg-accent-soft text-accent-solid',
  validation: 'bg-accent-soft text-accent-solid',
  extraction: 'bg-ok-soft text-ok',
  recommendation: 'bg-warn-soft text-warn',
  'knowledge-base': 'bg-cyan-100 text-cyan-700',
  'anomaly-detection': 'bg-stop-soft text-stop',
  status: 'bg-ok-soft text-ok',
};

interface AgentLibraryProps {
  agents: AIAgent[];
  onSelectAgent: (agent: AIAgent) => void;
  onAddAgent: () => void;
  /** Raise the delete confirmation for this agent; the page owns the dialog. */
  onDeleteAgent: (agent: AIAgent) => void;
}

export function AgentLibrary({ agents, onSelectAgent, onAddAgent, onDeleteAgent }: AgentLibraryProps) {
  const columns: Column<AIAgent & Record<string, unknown>>[] = [
    {
      key: 'name',
      label: 'Agent Name',
      sortable: true,
      render: (agent) => (
        <span className="font-medium text-ink">{agent.name}</span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      render: (agent) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[agent.type as string] ?? 'bg-idle-soft text-ink-2'}`}>
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
      key: 'lastUpdated',
      label: 'Last Updated',
      sortable: true,
      render: (agent) => (
        <span className="text-sm text-ink-3">{formatDate(agent.lastUpdated as string)}</span>
      ),
    },
    {
      key: 'affects',
      label: 'Affects',
      render: (agent) => {
        const affects = AGENT_AFFECTS[agent.id as string] ?? [];
        if (!affects.length) return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {affects.map((surface) => (
              <span key={surface} className="inline-flex rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent-solid border border-accent-line">
                {surface}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'actions',
      label: '',
      render: (agent) => (
        <Button
          variant="ghost"
          size="sm"
          className="text-stop hover:text-stop"
          // The row itself opens the agent, so the click must not do both.
          onClick={(e) => { e.stopPropagation(); onDeleteAgent(agent as unknown as AIAgent); }}
        >
          <Trash2 className="size-3.5" />
        </Button>
      ),
    },
  ];

  const tableData = agents.map((a) => ({ ...a } as AIAgent & Record<string, unknown>));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">Agent Library</h2>
          <p className="text-xs text-ink-3">{agents.length} agents configured</p>
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
