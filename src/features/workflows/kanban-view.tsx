// The Active Workflows board: a column per stage with its requests, each card
// opening the request. View-only (decided 2026-09-26): a drop used to move the
// request to any stage through api/workflow-action.ts, past its gates, blocking
// forms, onboarding checks and approvals — the server checked only that the
// stage existed. A stage moves on the request page, whose stage action checks
// them, and the endpoint now refuses a board move.
import { formatCurrency } from '@/lib/format';
import type { ProcurementRequest, RequestStatus } from '@/data/types';
import { WorkflowCard } from './components/workflow-card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { stageLabelShort } from '@/lib/workflow/stage-labels';

const STAGE_ORDER: RequestStatus[] = [
  'intake',
  'validation',
  'approval',
  'sourcing',
  'contracting',
  'po',
  'receipt',
  'invoice',
  'payment',
];

interface KanbanColumnProps {
  stage: RequestStatus;
  requests: ProcurementRequest[];
  onCardClick?: (id: string) => void;
}

function KanbanColumn({ stage, requests, onCardClick }: KanbanColumnProps) {
  const totalValue = requests.reduce((sum, r) => sum + r.value, 0);

  return (
    <section
      aria-label={stageLabelShort(stage)}
      className="flex w-[260px] shrink-0 flex-col rounded-md border bg-card-2/80"
    >
      <div className="border-b bg-card px-3 py-2 rounded-t-md">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-ink-2">
            {stageLabelShort(stage)}
          </h3>
          <span className="rounded-full bg-line px-1.5 py-0.5 text-[10px] font-medium text-ink-2">
            {requests.length}
          </span>
        </div>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {formatCurrency(totalValue)}
        </p>
      </div>

      <div className="flex flex-col gap-2 p-2 min-h-[80px] overflow-y-auto max-h-[calc(100vh-280px)]">
        {requests.map((req) => (
          <WorkflowCard
            key={req.id}
            request={req}
            onClick={() => onCardClick?.(req.id)}
          />
        ))}
      </div>
    </section>
  );
}

interface KanbanViewProps {
  requests: ProcurementRequest[];
  onCardClick?: (id: string) => void;
}

export function KanbanView({ requests, onCardClick }: KanbanViewProps) {
  const grouped = STAGE_ORDER.reduce<Record<string, ProcurementRequest[]>>(
    (acc, stage) => {
      acc[stage] = requests.filter((r) => r.status === stage);
      return acc;
    },
    {},
  );

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-3 pb-4">
        {STAGE_ORDER.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            requests={grouped[stage] ?? []}
            onCardClick={onCardClick}
          />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
