import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import type { ProcurementRequest, RequestStatus } from '@/data/types';
import { useStageSlas } from '@/lib/db/hooks/use-stage-slas';
import { stageSlaDays, type StageSla } from '@/lib/workflow/stage-sla';
import { stageLabelShort } from '@/lib/workflow/stage-labels';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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


function getStageIndex(status: RequestStatus): number {
  const idx = STAGE_ORDER.indexOf(status);
  return idx >= 0 ? idx : 0;
}

/**
 * For each request, generate a "bar" for each stage showing estimated days.
 * Completed stages get a base width, current stage uses actual daysInStage,
 * future stages are gray placeholders.
 */
function getStageSegments(request: ProcurementRequest, slaTargets: StageSla[]) {
  const currentIdx = getStageIndex(request.status as RequestStatus);
  const baseDays = 3;

  return STAGE_ORDER.map((stage, i) => {
    let days: number;
    let state: 'completed' | 'current' | 'future';

    if (i < currentIdx) {
      days = baseDays;
      state = 'completed';
    } else if (i === currentIdx) {
      days = request.daysInStage;
      state = 'current';
    } else {
      days = 0;
      state = 'future';
    }

    const slaThreshold = (stageSlaDays(slaTargets, stage) ?? 0);
    const isLong = state !== 'future' && days > slaThreshold;

    return { stage, days, state, isLong };
  });
}

interface TimelineViewProps {
  requests: ProcurementRequest[];
}

export function TimelineView({ requests }: TimelineViewProps) {
  const { data: slaTargets } = useStageSlas();
  // Only show active (non-draft, non-completed, non-cancelled) requests
  const activeRequests = requests.filter(
    (r) =>
      r.status !== 'draft' &&
      r.status !== 'completed' &&
      r.status !== 'cancelled',
  );

  return (
    <div className="space-y-0">
      {/* Stage header */}
      <div className="flex items-end border-b pb-2 mb-2">
        <div className="w-[200px] shrink-0 pr-3">
          <span className="text-xs font-medium text-muted-foreground">
            Request
          </span>
        </div>
        <div className="flex flex-1 min-w-0">
          {STAGE_ORDER.map((stage) => (
            <div
              key={stage}
              className="flex-1 text-center text-[10px] font-medium text-muted-foreground"
            >
              {stageLabelShort(stage)}
            </div>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div className="space-y-1.5 max-h-[calc(100vh-300px)] overflow-y-auto">
        {activeRequests.map((request) => {
          const segments = getStageSegments(request, slaTargets);

          return (
            <div key={request.id} className="flex items-center group">
              {/* Label */}
              <div className="w-[200px] shrink-0 pr-3">
                <p className="text-xs font-medium text-gray-900 truncate">
                  {request.title}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {request.id} &middot;{' '}
                  {formatCurrency(request.value, request.currency)}
                </p>
              </div>

              {/* Timeline bars */}
              <div className="flex flex-1 items-center gap-px min-w-0">
                {segments.map((seg) => {
                  const bgClass =
                    seg.state === 'completed'
                      ? seg.isLong
                        ? 'bg-amber-400'
                        : 'bg-green-500'
                      : seg.state === 'current'
                        ? seg.isLong
                          ? 'bg-red-400'
                          : 'bg-amber-400'
                        : 'bg-gray-200';

                  return (
                    <Tooltip key={seg.stage}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            'h-6 rounded-sm transition-all flex-1',
                            bgClass,
                            seg.state === 'future' && 'opacity-50',
                          )}
                          style={{
                            flex:
                              seg.state === 'future'
                                ? '1'
                                : `${Math.max(seg.days, 1)}`,
                          }}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <p className="font-medium">
                          {stageLabelShort(seg.stage)}
                        </p>
                        {seg.state === 'future' ? (
                          <p className="text-muted-foreground">Pending</p>
                        ) : (
                          <p>
                            {seg.days} day{seg.days !== 1 ? 's' : ''}
                            {seg.isLong ? ' (over SLA)' : ''}
                          </p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-[10px] text-muted-foreground border-t pt-2">
        <div className="flex items-center gap-1">
          <div className="size-3 rounded-sm bg-green-500" />
          <span>Completed (on time)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="size-3 rounded-sm bg-amber-400" />
          <span>Current / slow stage</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="size-3 rounded-sm bg-red-400" />
          <span>Current (over SLA)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="size-3 rounded-sm bg-gray-200" />
          <span>Future stages</span>
        </div>
      </div>
    </div>
  );
}
