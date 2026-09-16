// Bar chart of average days-in-stage per workflow stage, with each stage's SLA
// target (admin-configured) drawn as a reference line, so breaches are visible
// at a glance rather than read off a table.
import { useMemo } from 'react';
import { useStageSlas } from '@/lib/db/hooks/use-stage-slas';
import { stageSlaDays } from '@/lib/workflow/stage-sla';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { ProcurementRequest, RequestStatus } from '@/data/types';
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


interface BottleneckChartProps {
  requests: ProcurementRequest[];
}

export function BottleneckChart({ requests }: BottleneckChartProps) {
  const { data: slaTargets } = useStageSlas();

  const data = useMemo(() => {
    return STAGE_ORDER.map((stage) => {
      const stageRequests = requests.filter((r) => r.status === stage);
      const avgDays =
        stageRequests.length > 0
          ? stageRequests.reduce((sum, r) => sum + r.daysInStage, 0) /
            stageRequests.length
          : 0;
      const slaTarget = (stageSlaDays(slaTargets, stage) ?? 0);

      return {
        name: stageLabelShort(stage),
        value: Math.round(avgDays * 10) / 10,
        count: stageRequests.length,
        exceedsSLA: avgDays > slaTarget,
        slaTarget,
      };
    });
  }, [requests, slaTargets]);

  const globalSlaTarget = (stageSlaDays(slaTargets, 'approval') ?? 0); // representative line

  return (
    <div className="rounded-md border bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        Average Days per Stage
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis
            type="number"
            tick={{ fontSize: 12, fill: '#718096' }}
            domain={[0, 'auto']}
          />
          <YAxis
            dataKey="name"
            type="category"
            tick={{ fontSize: 12, fill: '#718096' }}
            width={100}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #E2E8F0',
              borderRadius: 6,
              fontSize: 12,
            }}
            formatter={(value) => [
              `${value} days`,
              'Avg. Days',
            ]}
          />
          <ReferenceLine
            x={globalSlaTarget}
            stroke="#EF4444"
            strokeDasharray="4 4"
            label={{
              value: `SLA: ${globalSlaTarget}d`,
              position: 'top',
              fontSize: 11,
              fill: '#EF4444',
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.exceedsSLA ? '#EF4444' : '#3B82F6'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
