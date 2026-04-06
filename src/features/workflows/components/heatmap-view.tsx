import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { ProcurementRequest, RequestStatus } from '@/data/types';

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

const STAGE_LABELS: Record<string, string> = {
  intake: 'Intake',
  validation: 'Validation',
  approval: 'Approval',
  sourcing: 'Sourcing',
  contracting: 'Contracting',
  po: 'PO',
  receipt: 'Receipt',
  invoice: 'Invoice',
  payment: 'Payment',
};

function getWeekLabel(weeksAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - weeksAgo * 7);
  const month = d.toLocaleString('en-IE', { month: 'short' });
  const day = d.getDate();
  return `${month} ${day}`;
}

/**
 * Generate simulated heatmap data.
 * Uses actual request data for the current week and generates plausible
 * historical data for the previous 7 weeks.
 */
function generateHeatmapData(requests: ProcurementRequest[]) {
  const weeks = Array.from({ length: 8 }, (_, i) => 7 - i); // 7 weeks ago down to 0

  // Count current requests per stage
  const currentCounts: Record<string, number> = {};
  for (const stage of STAGE_ORDER) {
    currentCounts[stage] = requests.filter((r) => r.status === stage).length;
  }

  // Build the grid: each cell is { week, stage, count }
  const grid = weeks.map((weeksAgo) => {
    return STAGE_ORDER.map((stage) => {
      if (weeksAgo === 0) {
        return { weeksAgo, stage, count: currentCounts[stage] ?? 0 };
      }
      // Simulate: base it on current count with some variance
      const base = currentCounts[stage] ?? 0;
      const variance = Math.floor(Math.random() * 3) - 1;
      const count = Math.max(0, base + variance + Math.floor(weeksAgo / 3));
      return { weeksAgo, stage, count };
    });
  });

  return { weeks, grid };
}

interface HeatmapViewProps {
  requests: ProcurementRequest[];
}

export function HeatmapView({ requests }: HeatmapViewProps) {
  const { weeks, grid } = useMemo(
    () => generateHeatmapData(requests),
    [requests],
  );

  // Find max count for intensity scaling
  const maxCount = Math.max(
    ...grid.flatMap((row) => row.map((cell) => cell.count)),
    1,
  );

  function getIntensityClass(count: number): string {
    if (count === 0) return 'bg-gray-100';
    const ratio = count / maxCount;
    if (ratio <= 0.2) return 'bg-blue-100';
    if (ratio <= 0.4) return 'bg-blue-200';
    if (ratio <= 0.6) return 'bg-blue-400';
    if (ratio <= 0.8) return 'bg-blue-500';
    return 'bg-blue-700';
  }

  return (
    <div className="rounded-md border bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        Pipeline Heatmap (Last 8 Weeks)
      </h3>

      <div className="overflow-x-auto">
        {/* Stage headers */}
        <div className="flex items-end mb-1">
          <div className="w-[80px] shrink-0" />
          {STAGE_ORDER.map((stage) => (
            <div
              key={stage}
              className="flex-1 text-center text-[10px] font-medium text-muted-foreground px-0.5"
            >
              {STAGE_LABELS[stage]}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {grid.map((row, rowIdx) => (
          <div key={rowIdx} className="flex items-center gap-0.5 mb-0.5">
            <div className="w-[80px] shrink-0 text-[10px] text-muted-foreground text-right pr-2">
              {getWeekLabel(weeks[rowIdx])}
            </div>
            {row.map((cell, colIdx) => (
              <div
                key={colIdx}
                className={cn(
                  'flex-1 h-7 rounded-sm flex items-center justify-center text-[10px] font-medium transition-colors',
                  getIntensityClass(cell.count),
                  cell.count > 0 && cell.count >= maxCount * 0.6
                    ? 'text-white'
                    : 'text-gray-600',
                )}
                title={`${STAGE_LABELS[cell.stage]}: ${cell.count} requests`}
              >
                {cell.count > 0 ? cell.count : ''}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
        <span>Less</span>
        <div className="size-3 rounded-sm bg-gray-100" />
        <div className="size-3 rounded-sm bg-blue-100" />
        <div className="size-3 rounded-sm bg-blue-200" />
        <div className="size-3 rounded-sm bg-blue-400" />
        <div className="size-3 rounded-sm bg-blue-500" />
        <div className="size-3 rounded-sm bg-blue-700" />
        <span>More</span>
      </div>
    </div>
  );
}
