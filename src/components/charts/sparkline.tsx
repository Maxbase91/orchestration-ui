import { useId } from 'react';
import { AreaChart, Area } from 'recharts';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  /**
   * Any CSS colour — including `var(--ok)`, which is how callers name a theme
   * token rather than a hex. The gradient id used to be derived from this
   * string (`sparkGrad-${color.replace('#','')}`), which produced
   * `sparkGrad-var(--ok)` for a token: invalid in an id and in the `url(#…)`
   * that references it, so the fill silently disappeared. `useId` gives a stable
   * unique id that does not depend on the colour's spelling, and also fixes the
   * collision two sparklines of the same colour had on the same page.
   */
  color?: string;
}

export function Sparkline({ data, width = 80, height = 30, color = 'var(--accent)' }: SparklineProps) {
  const gradientId = useId();
  const chartData = data.map((value, index) => ({ index, value }));

  return (
    <AreaChart width={width} height={height} data={chartData}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0.05} />
        </linearGradient>
      </defs>
      <Area
        type="monotone"
        dataKey="value"
        stroke={color}
        strokeWidth={1.5}
        fill={`url(#${gradientId})`}
        dot={false}
        isAnimationActive={false}
      />
    </AreaChart>
  );
}
