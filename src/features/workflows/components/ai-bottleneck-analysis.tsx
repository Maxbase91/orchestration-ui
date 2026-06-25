import type { ProcurementRequest, RequestStatus } from '@/data/types';
import { useRequests } from '@/lib/db/hooks/use-requests';

const STAGE_LABEL: Partial<Record<RequestStatus, string>> = {
  intake: 'Intake',
  validation: 'Validation',
  approval: 'Approval',
  sourcing: 'Sourcing',
  contracting: 'Contracting',
  po: 'PO Creation',
};
const ACTIVE_STAGES = Object.keys(STAGE_LABEL) as RequestStatus[];

interface StageStat {
  stage: string;
  count: number;
  avgDays: number;
  overdue: number;
}

/** Real bottleneck stats off the live pipeline — active stages ranked by the
 *  average time requests have spent in them. No model, no fabricated numbers. */
function analyseBottlenecks(requests: ProcurementRequest[]): StageStat[] {
  const byStage = new Map<string, ProcurementRequest[]>();
  for (const r of requests) {
    if (!ACTIVE_STAGES.includes(r.status)) continue;
    const label = STAGE_LABEL[r.status] ?? r.status;
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
  const stats = analyseBottlenecks(requests);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Bottleneck Analysis</h3>

      {stats.length === 0 ? (
        <p className="text-sm text-gray-500">No active requests to analyse yet.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-1 lg:grid-cols-3">
          {stats.map((s) => (
            <div key={s.stage} className="rounded-md border-l-2 border-blue-400 bg-blue-50/70 p-4">
              <p className="text-sm font-medium text-gray-900">{s.stage}</p>
              <p className="mt-1 text-sm text-gray-700">
                {s.count} active request{s.count > 1 ? 's' : ''}, averaging {s.avgDays} day
                {s.avgDays !== 1 ? 's' : ''} in stage{s.overdue > 0 ? ` · ${s.overdue} past SLA` : ''}.
              </p>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-gray-400">
        Derived from live request data — active stages ranked by average time in stage.
      </p>
    </div>
  );
}
