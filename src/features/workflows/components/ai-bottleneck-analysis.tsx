import type { ProcurementRequest, RequestStatus } from '@/data/types';
import { useMemo } from 'react';
import { useRequests } from '@/lib/db/hooks/use-requests';
import { useChannelStageMap } from '@/lib/db/hooks/use-channel-stage-map';
import { lifecycleStagesFrom } from '@/lib/workflow/channel-stages';
import { stageLabel } from '@/lib/workflow/stage-labels';

// The stage list was `Object.keys` of a six-entry label map, so this analysed
// six of eleven stages and silently never reported a bottleneck in receipt,
// invoice, payment, risk or onboarding — the back half of the lifecycle, where
// requests actually pile up. A label map is not a stage list.

interface StageStat {
  stage: string;
  count: number;
  avgDays: number;
  overdue: number;
}

/** Real bottleneck stats off the live pipeline — active stages ranked by the
 *  average time requests have spent in them. No model, no fabricated numbers. */
function analyseBottlenecks(
  requests: ProcurementRequest[],
  activeStages: readonly RequestStatus[],
): StageStat[] {
  const byStage = new Map<string, ProcurementRequest[]>();
  for (const r of requests) {
    if (!activeStages.includes(r.status)) continue;
    const label = stageLabel(r.status);
    const arr = byStage.get(label);
    if (arr) arr.push(r);
    else byStage.set(label, [r]);
  }
  return Array.from(byStage.entries())
    .map(([stage, rs]) => ({
      stage,
      count: rs.length,
      avgDays: Math.round(rs.reduce((s, r) => s + r.daysInStage, 0) / rs.length),
      overdue: rs.filter((r) => r.isOverdue).length,
    }))
    .sort((a, b) => b.avgDays - a.avgDays)
    .slice(0, 3);
}

export function AIBottleneckAnalysis() {
  const { data: requests = [] } = useRequests();
  // Every stage any channel traverses, from the workflow templates — not the
  // keys of a six-entry label map, which is what limited this to the front half
  // of the lifecycle.
  const { data: channelStageMap } = useChannelStageMap();
  const activeStages = useMemo(() => lifecycleStagesFrom(channelStageMap), [channelStageMap]);
  const stats = useMemo(
    () => analyseBottlenecks(requests, activeStages),
    [requests, activeStages],
  );

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-ink">Bottleneck Analysis</h3>

      {stats.length === 0 ? (
        <p className="text-sm text-ink-3">No active requests to analyse yet.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-1 lg:grid-cols-3">
          {stats.map((s) => (
            <div key={s.stage} className="rounded-md border-l-2 border-accent-solid bg-accent-soft/70 p-4">
              <p className="text-sm font-medium text-ink">{s.stage}</p>
              <p className="mt-1 text-sm text-ink-2">
                {s.count} active request{s.count > 1 ? 's' : ''}, averaging {s.avgDays} day
                {s.avgDays !== 1 ? 's' : ''} in stage{s.overdue > 0 ? ` · ${s.overdue} past SLA` : ''}.
              </p>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-ink-3">
        Derived from live request data — active stages ranked by average time in stage.
      </p>
    </div>
  );
}
