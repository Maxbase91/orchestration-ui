import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface BarChartWidgetProps {
  data: { name: string; value: number; [key: string]: unknown }[];
  dataKeys: { key: string; color: string; label: string }[];
  xAxisKey?: string;
  height?: number;
  showLegend?: boolean;
  layout?: 'vertical' | 'horizontal';
}

export function BarChartWidget({
  data,
  dataKeys,
  xAxisKey = 'name',
  height = 300,
  showLegend = false,
  layout = 'horizontal',
}: BarChartWidgetProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout === 'vertical' ? 'vertical' : 'horizontal'}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
        {layout === 'vertical' ? (
          <>
            <XAxis type="number" tick={{ fontSize: 12, fill: '#718096' }} />
            <YAxis dataKey={xAxisKey} type="category" tick={{ fontSize: 12, fill: '#718096' }} width={100} />
          </>
        ) : (
          <>
            <XAxis dataKey={xAxisKey} tick={{ fontSize: 12, fill: '#718096' }} />
            <YAxis tick={{ fontSize: 12, fill: '#718096' }} />
          </>
        )}
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
          <Bar
            key={dk.key}
            dataKey={dk.key}
            name={dk.label}
            fill={dk.color}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
