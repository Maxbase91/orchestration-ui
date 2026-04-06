import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sparkline } from '@/components/charts/sparkline';

interface KPICardProps {
  label: string;
  value: string | number;
  trend?: { direction: 'up' | 'down' | 'flat'; percentage: number };
  sparklineData?: number[];
  format?: 'number' | 'currency' | 'percentage';
  onClick?: () => void;
}

function formatValue(value: string | number, format?: string): string {
  if (typeof value === 'string') return value;
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);
    case 'percentage':
      return `${value}%`;
    default:
      return new Intl.NumberFormat('en-GB').format(value);
  }
}

const trendConfig = {
  up: { icon: TrendingUp, color: 'text-green-600' },
  down: { icon: TrendingDown, color: 'text-red-600' },
  flat: { icon: Minus, color: 'text-gray-500' },
} as const;

export function KPICard({ label, value, trend, sparklineData, format, onClick }: KPICardProps) {
  return (
    <div
      className={cn(
        'rounded-md bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]',
        onClick && 'cursor-pointer hover:shadow-md transition-shadow'
      )}
      onClick={onClick}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div>
          <p className="text-2xl font-semibold text-gray-900">{formatValue(value, format)}</p>
          {trend && (
            <div className={cn('mt-0.5 flex items-center gap-1 text-xs font-medium', trendConfig[trend.direction].color)}>
              {(() => {
                const Icon = trendConfig[trend.direction].icon;
                return <Icon className="size-3.5" />;
              })()}
              <span>{trend.percentage}%</span>
            </div>
          )}
        </div>
        {sparklineData && sparklineData.length > 1 && (
          <Sparkline
            data={sparklineData}
            width={80}
            height={30}
            color={
              trend?.direction === 'down'
                ? '#B5392E'
                : trend?.direction === 'up'
                  ? '#2E7D4F'
                  : '#718096'
            }
          />
        )}
      </div>
    </div>
  );
}
