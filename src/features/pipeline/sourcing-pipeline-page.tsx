import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

type SourcingStage = 'Draft' | 'Published' | 'In Evaluation' | 'Award Pending' | 'Completed';

interface SourcingEvent extends Record<string, unknown> {
  id: string;
  title: string;
  category: string;
  stage: SourcingStage;
  value: number;
  suppliers: number;
  deadline: string;
  owner: string;
}

const STAGES: SourcingStage[] = ['Draft', 'Published', 'In Evaluation', 'Award Pending', 'Completed'];

const STAGE_COLORS: Record<SourcingStage, string> = {
  Draft: 'bg-gray-200',
  Published: 'bg-blue-500',
  'In Evaluation': 'bg-yellow-500',
  'Award Pending': 'bg-orange-500',
  Completed: 'bg-green-500',
};

const sourcingEvents: SourcingEvent[] = [
  {
    id: 'SE-001',
    title: 'Cloud Data Platform RFP',
    category: 'IT Services',
    stage: 'In Evaluation',
    value: 350000,
    suppliers: 4,
    deadline: '2025-02-15',
    owner: 'Sarah Chen',
  },
  {
    id: 'SE-002',
    title: 'Office Cleaning Services Tender',
    category: 'Facilities',
    stage: 'Published',
    value: 180000,
    suppliers: 6,
    deadline: '2025-02-28',
    owner: 'Anna Muller',
  },
  {
    id: 'SE-003',
    title: 'Cybersecurity Consulting Framework',
    category: 'Professional Services',
    stage: 'Award Pending',
    value: 500000,
    suppliers: 3,
    deadline: '2025-01-31',
    owner: 'Marcus Johnson',
  },
  {
    id: 'SE-004',
    title: 'Fleet Management RFQ',
    category: 'Logistics',
    stage: 'Draft',
    value: 220000,
    suppliers: 0,
    deadline: '2025-03-15',
    owner: 'Anna Muller',
  },
  {
    id: 'SE-005',
    title: 'Employee Benefits Platform',
    category: 'HR Services',
    stage: 'Completed',
    value: 150000,
    suppliers: 5,
    deadline: '2024-12-31',
    owner: 'Marcus Johnson',
  },
  {
    id: 'SE-006',
    title: 'Network Equipment Refresh',
    category: 'IT Hardware',
    stage: 'Published',
    value: 280000,
    suppliers: 4,
    deadline: '2025-02-20',
    owner: 'Sarah Chen',
  },
];

export function SourcingPipelinePage() {
  const [selectedStage, setSelectedStage] = useState<SourcingStage | 'All'>('All');

  const filteredEvents = selectedStage === 'All'
    ? sourcingEvents
    : sourcingEvents.filter((e) => e.stage === selectedStage);

  const stageCounts = STAGES.map((stage) => ({
    stage,
    count: sourcingEvents.filter((e) => e.stage === stage).length,
  }));

  const columns: Column<SourcingEvent>[] = [
    {
      key: 'id',
      label: 'ID',
      render: (row) => <span className="font-mono text-xs">{row.id as string}</span>,
    },
    {
      key: 'title',
      label: 'Title',
      sortable: true,
      render: (row) => <span className="text-sm font-medium">{row.title as string}</span>,
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
    },
    {
      key: 'stage',
      label: 'Stage',
      render: (row) => {
        const stageColors: Record<string, string> = {
          Draft: 'bg-gray-100 text-gray-700',
          Published: 'bg-blue-100 text-blue-700',
          'In Evaluation': 'bg-yellow-100 text-yellow-700',
          'Award Pending': 'bg-orange-100 text-orange-700',
          Completed: 'bg-green-100 text-green-700',
        };
        return (
          <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', stageColors[row.stage as string] ?? '')}>
            {row.stage as string}
          </span>
        );
      },
    },
    {
      key: 'value',
      label: 'Est. Value',
      sortable: true,
      render: (row) => <span className="text-sm">{formatCurrency(row.value as number)}</span>,
    },
    {
      key: 'suppliers',
      label: 'Suppliers',
      render: (row) => <span className="text-sm text-center">{row.suppliers as number}</span>,
    },
    {
      key: 'deadline',
      label: 'Deadline',
      sortable: true,
      render: (row) => <span className="text-sm">{formatDate(row.deadline as string)}</span>,
    },
    {
      key: 'owner',
      label: 'Owner',
      sortable: true,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Sourcing Pipeline" subtitle="Track sourcing events from draft to completion" />

      {/* Pipeline visualization */}
      <div className="rounded-md border bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Pipeline Stages</h3>
        <div className="flex gap-1">
          {stageCounts.map(({ stage, count }, idx) => (
            <button
              key={stage}
              className={cn(
                'flex-1 py-3 px-2 text-center transition-opacity',
                'rounded-md cursor-pointer hover:opacity-90',
                selectedStage === stage ? 'ring-2 ring-offset-1 ring-gray-900' : '',
                idx === 0 && 'rounded-l-lg',
                idx === STAGES.length - 1 && 'rounded-r-lg',
              )}
              style={{ backgroundColor: `var(--stage-${idx})` }}
              onClick={() => setSelectedStage(selectedStage === stage ? 'All' : stage)}
            >
              <div className={cn('text-xs font-medium', STAGE_COLORS[stage])}>
                <div className={cn(
                  'w-full rounded-md py-3 px-1',
                  STAGE_COLORS[stage],
                )}>
                  <p className="text-white text-xs font-medium">{stage}</p>
                  <p className="text-white text-lg font-bold">{count}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
        {/* Arrow connectors */}
        <div className="flex items-center justify-center mt-2 gap-1">
          {STAGES.map((stage, idx) => (
            <div key={stage} className="flex items-center flex-1">
              <div className="flex-1 h-0.5 bg-gray-300" />
              {idx < STAGES.length - 1 && (
                <div className="text-gray-400 text-xs mx-1">&rarr;</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredEvents}
        searchable
        searchPlaceholder="Search sourcing events..."
        emptyMessage="No sourcing events found."
      />
    </div>
  );
}
