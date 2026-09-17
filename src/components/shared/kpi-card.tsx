// Dashboard KPI tile: headline value with optional trend arrow and sparkline.
// Currency formatting follows the user's currency preference from the
// settings store so every KPI renders in the same unit.
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sparkline } from '@/components/charts/sparkline';
import { useSettingsStore } from '@/stores/settings-store';

interface KPICardProps {
  label: string;
  value: string | number;
  trend?: { direction: 'up' | 'down' | 'flat'; percentage: number };
  sparklineData?: number[];
  format?: 'number' | 'currency' | 'percentage';
  onClick?: () => void;
}

function formatValue(value: string | number, format?: string, currency = 'EUR'): string {
  if (typeof value === 'string') return value;
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('de-DE', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
    case 'percentage':
      return `${value}%`;
    default:
      return new Intl.NumberFormat('en-GB').format(value);
  }
}

// The arrow is the non-colour signal: direction is readable in greyscale, and
// the icon is labelled for a screen reader below.
const trendConfig = {
  up: { icon: TrendingUp, color: 'text-ok', label: 'up' },
  down: { icon: TrendingDown, color: 'text-stop', label: 'down' },
  flat: { icon: Minus, color: 'text-ink-3', label: 'flat' },
} as const;

/** The sparkline follows the trend, through tokens rather than pinned hexes. */
const SPARK_COLOR = {
  up: 'var(--ok)', down: 'var(--stop)', flat: 'var(--idle)',
} as const;

export function KPICard({ label, value, trend, sparklineData, format, onClick }: KPICardProps) {
  const { currency } = useSettingsStore();
  const Icon = trend ? trendConfig[trend.direction].icon : null;

  const body = (
    <>
      <p className="text-caption font-medium text-ink-3">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div>
          {/* The headline figure, in tabular numerals — a row of KPI tiles is
              read across, and proportional digits make them ragged. */}
          <p className="text-display font-semibold tabular-nums text-ink">
            {formatValue(value, format, currency)}
          </p>
          {trend && Icon && (
            <div className={cn(
              'mt-0.5 flex items-center gap-1 text-caption font-medium tabular-nums',
              trendConfig[trend.direction].color,
            )}>
              <Icon className="size-3.5" aria-hidden="true" />
              <span>
                <span className="sr-only">Trend {trendConfig[trend.direction].label}, </span>
                {trend.percentage}%
              </span>
            </div>
          )}
        </div>
        {sparklineData && sparklineData.length > 1 && (
          <Sparkline
            data={sparklineData}
            width={80}
            height={30}
            color={SPARK_COLOR[trend?.direction ?? 'flat']}
          />
        )}
      </div>
    </>
  );

  // A tile that navigates is a button, not a div with a click handler — this
  // was one of the three keyboard-unreachable click targets the audit found,
  // and it is on the dashboard every role lands on.
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'w-full rounded-md bg-card-surface p-4 text-left shadow-[var(--shadow)]',
          'transition-shadow hover:shadow-[var(--shadow-lift)]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-solid',
        )}
      >
        {body}
      </button>
    );
  }

  return (
    <div className="rounded-md bg-card-surface p-4 shadow-[var(--shadow)]">
      {body}
    </div>
  );
}
