import type { PieLabelRenderProps } from 'recharts';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface PieChartWidgetProps {
  data: { name: string; value: number; color?: string }[];
  height?: number;
  innerRadius?: number;
  showLabels?: boolean;
  showLegend?: boolean;
}

const DEFAULT_COLORS = ['#1B2A4A', '#2D5F8A', '#D4782F', '#2E7D4F', '#B5392E', '#718096', '#6B46C1', '#2B6CB0'];

export function PieChartWidget({
  data,
  height = 300,
  innerRadius = 0,
  showLabels = false,
  showLegend = true,
}: PieChartWidgetProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius="80%"
          label={showLabels ? (props: PieLabelRenderProps) => `${props.name ?? ''} ${((props.percent ?? 0) * 100).toFixed(0)}%` : undefined}
          labelLine={showLabels}
          strokeWidth={2}
          stroke="#fff"
        >
          {data.map((entry, index) => (
            <Cell
              key={entry.name}
              fill={entry.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        {showLegend && <Legend wrapperStyle={{ fontSize: 12 }} />}
      </PieChart>
    </ResponsiveContainer>
  );
}
