import { AreaChart, Area } from 'recharts';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function Sparkline({ data, width = 80, height = 30, color = '#2D5F8A' }: SparklineProps) {
  const chartData = data.map((value, index) => ({ index, value }));

  return (
    <AreaChart width={width} height={height} data={chartData}>
      <defs>
        <linearGradient id={`sparkGrad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0.05} />
        </linearGradient>
      </defs>
      <Area
        type="monotone"
        dataKey="value"
        stroke={color}
        strokeWidth={1.5}
        fill={`url(#sparkGrad-${color.replace('#', '')})`}
        dot={false}
        isAnimationActive={false}
      />
    </AreaChart>
  );
}
