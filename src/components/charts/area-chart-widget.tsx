import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface AreaChartWidgetProps {
  data: { name: string; [key: string]: unknown }[];
  dataKeys: { key: string; color: string; label: string }[];
  xAxisKey?: string;
  height?: number;
  showLegend?: boolean;
  stacked?: boolean;
}

export function AreaChartWidget({
  data,
  dataKeys,
  xAxisKey = 'name',
  height = 300,
  showLegend = false,
  stacked = false,
}: AreaChartWidgetProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <defs>
          {dataKeys.map((dk) => (
            <linearGradient key={dk.key} id={`areaGrad-${dk.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={dk.color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={dk.color} stopOpacity={0.05} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
        <XAxis dataKey={xAxisKey} tick={{ fontSize: 12, fill: '#718096' }} />
        <YAxis tick={{ fontSize: 12, fill: '#718096' }} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        {showLegend && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {dataKeys.map((dk) => (
          <Area
            key={dk.key}
            type="monotone"
            dataKey={dk.key}
            name={dk.label}
            stroke={dk.color}
            strokeWidth={2}
            fill={`url(#areaGrad-${dk.key})`}
            stackId={stacked ? 'stack' : undefined}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
