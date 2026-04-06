import { useMemo } from 'react';
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

const SLA_TARGET = 5;

interface BottleneckChartProps {
  requests: ProcurementRequest[];
}

export function BottleneckChart({ requests }: BottleneckChartProps) {
  const data = useMemo(() => {
    return STAGE_ORDER.map((stage) => {
      const stageRequests = requests.filter((r) => r.status === stage);
      const avgDays =
        stageRequests.length > 0
          ? stageRequests.reduce((sum, r) => sum + r.daysInStage, 0) /
            stageRequests.length
          : 0;

      return {
        name: STAGE_LABELS[stage],
        value: Math.round(avgDays * 10) / 10,
        count: stageRequests.length,
        exceedsSLA: avgDays > SLA_TARGET,
      };
    });
  }, [requests]);

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
            x={SLA_TARGET}
            stroke="#EF4444"
            strokeDasharray="4 4"
            label={{
              value: `SLA: ${SLA_TARGET}d`,
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
