// Sourcing pipeline page: the same events as /sourcing, arranged by stage.
//
// Reads live events and their real invitation counts. It previously rendered an
// `SE-*` array of its own — the third mock universe for one concept, alongside
// the feature's `SRC-*` and the portal's `EVT-*` — so the pipeline, the register
// and the portal each described a different set of sourcing events.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useSourcingEvents } from '@/lib/db/hooks/use-sourcing-events';
import { useAllSourcingResponses } from '@/lib/db/hooks/use-sourcing-responses';
import { useUserLookup } from '@/lib/db/hooks/use-users';

type SourcingStage = 'Draft' | 'Published' | 'In Evaluation' | 'Award Pending' | 'Completed';

/** Row shape for the table — the DB event flattened for display. */
interface SourcingEventRow extends Record<string, unknown> {
  id: string;
  title: string;
  category: string;
  stage: SourcingStage;
  value: number;
  suppliers: number;
  deadline: string;
  owner: string;
}

/**
 * DB status → the pipeline's display stage. `cancelled` deliberately has no
 * column: a cancelled event is not a stage of the funnel, so those rows are
 * dropped rather than silently filed under Draft.
 */
const STATUS_TO_STAGE: Record<string, SourcingStage> = {
  draft: 'Draft',
  published: 'Published',
  'in-evaluation': 'In Evaluation',
  'award-pending': 'Award Pending',
  completed: 'Completed',
};

const STAGES: SourcingStage[] = ['Draft', 'Published', 'In Evaluation', 'Award Pending', 'Completed'];

const STAGE_COLORS: Record<SourcingStage, string> = {
  Draft: 'bg-gray-200',
  Published: 'bg-blue-500',
  'In Evaluation': 'bg-yellow-500',
  'Award Pending': 'bg-orange-500',
  Completed: 'bg-green-500',
};

export function SourcingPipelinePage() {
  const [selectedStage, setSelectedStage] = useState<SourcingStage | 'All'>('All');
  const navigate = useNavigate();
  const { data: events = [], isLoading } = useSourcingEvents();
  const { data: responses = [] } = useAllSourcingResponses();
  const lookupUser = useUserLookup();

  const sourcingEvents: SourcingEventRow[] = useMemo(
    () =>
      events
        .filter((e) => STATUS_TO_STAGE[e.status])
        .map((e) => ({
          id: e.id,
          title: e.title,
          category: e.category,
          stage: STATUS_TO_STAGE[e.status]!,
          value: e.budget ?? 0,
          suppliers: responses.filter((r) => r.eventId === e.id).length,
          deadline: e.deadline ?? '',
          owner: lookupUser(e.ownerId)?.name ?? '—',
        })),
    [events, responses, lookupUser],
  );

  const filteredEvents = selectedStage === 'All'
    ? sourcingEvents
    : sourcingEvents.filter((e) => e.stage === selectedStage);

  const stageCounts = STAGES.map((stage) => ({
    stage,
    count: sourcingEvents.filter((e) => e.stage === stage).length,
  }));

  const columns: Column<SourcingEventRow>[] = [
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
      render: (row) => (
        <span className="text-sm">
          {row.deadline ? formatDate(row.deadline as string) : <span className="text-gray-400">—</span>}
        </span>
      ),
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
        emptyMessage={isLoading ? 'Loading sourcing events…' : 'No sourcing events found.'}
        onRowClick={(row) => navigate(`/sourcing/${row.id}`)}
      />
    </div>
  );
}
