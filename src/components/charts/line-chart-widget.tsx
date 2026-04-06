import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface LineChartWidgetProps {
  data: { name: string; [key: string]: unknown }[];
  dataKeys: { key: string; color: string; label: string }[];
  xAxisKey?: string;
  height?: number;
  showLegend?: boolean;
}

export function LineChartWidget({
  data,
  dataKeys,
  xAxisKey = 'name',
  height = 300,
  showLegend = false,
}: LineChartWidgetProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
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
          <Line
            key={dk.key}
            type="monotone"
            dataKey={dk.key}
            name={dk.label}
            stroke={dk.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
