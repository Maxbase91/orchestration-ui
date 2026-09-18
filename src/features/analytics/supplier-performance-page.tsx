import { useMemo } from 'react';
import { AlertTriangle, Star } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { BarChartWidget } from '@/components/charts/bar-chart-widget';
import { useSuppliers } from '@/lib/db/hooks/use-suppliers';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

const RISK_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function SupplierPerformancePage() {
  const { data: suppliers = [] } = useSuppliers();

  const scoredSuppliers = useMemo(
    () => suppliers.filter((s) => s.performanceScore > 0).sort((a, b) => b.performanceScore - a.performanceScore),
    [suppliers],
  );

  const topPerformers = useMemo(() => scoredSuppliers.slice(0, 5), [scoredSuppliers]);
  const bottomPerformers = useMemo(
    () => [...scoredSuppliers].reverse().slice(0, 5),
    [scoredSuppliers],
  );

  const perfByCategoryData = useMemo(() => {
    // Average performance score per supplier category. A supplier can tag
    // multiple categories; count them independently so each row reflects
    // the mean of suppliers active in that category.
    const buckets = new Map<string, { total: number; count: number }>();
    for (const s of suppliers) {
      if (!s.performanceScore || s.performanceScore <= 0) continue;
      for (const cat of s.categories ?? []) {
        const b = buckets.get(cat) ?? { total: 0, count: 0 };
        b.total += s.performanceScore;
        b.count += 1;
        buckets.set(cat, b);
      }
    }
    return Array.from(buckets.entries())
      .map(([name, { total, count }]) => ({ name, value: Math.round(total / count) }))
      .sort((a, b) => b.value - a.value);
  }, [suppliers]);

  const riskSpendMatrix = useMemo(
    () =>
      suppliers
        .filter((s) => s.totalSpend12m > 0)
        .sort((a, b) => (RISK_ORDER[a.riskRating] ?? 4) - (RISK_ORDER[b.riskRating] ?? 4)),
    [suppliers],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Performance"
        subtitle="Performance scores, category benchmarks, and risk-spend analysis"
      />

      {/* Top + Bottom Performers */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Performers */}
        <div className="rounded-md bg-card p-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
            <Star className="size-4 text-warn" />
            Top 5 Performers
          </h3>
          <div className="space-y-3">
            {topPerformers.map((s, i) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-md border border-line-2 p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-7 items-center justify-center rounded-full bg-ok-soft text-xs font-bold text-ok">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink">{s.name}</p>
                    <p className="text-xs text-ink-3">{s.categories[0]}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-ok">{s.performanceScore}</p>
                  <p className="text-xs text-ink-3">score</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Performers */}
        <div className="rounded-md bg-card p-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
            <AlertTriangle className="size-4 text-stop" />
            Bottom 5 Performers
          </h3>
          <div className="space-y-3">
            {bottomPerformers.map((s, i) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-md border border-stop-line p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-7 items-center justify-center rounded-full bg-stop-soft text-xs font-bold text-stop">
                    {scoredSuppliers.length - i}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink">{s.name}</p>
                    <p className="text-xs text-ink-3">{s.categories[0]}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-stop">{s.performanceScore}</p>
                  <p className="text-xs text-ink-3">score</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance by Category */}
      <div className="rounded-md bg-card p-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
        <h3 className="mb-4 text-sm font-semibold text-ink">Performance by Category</h3>
        <BarChartWidget
          data={perfByCategoryData}
          dataKeys={[{ key: 'value', color: '#1B2A4A', label: 'Avg Score' }]}
          height={280}
        />
      </div>

      {/* Risk vs Spend Matrix */}
      <div className="rounded-md bg-card p-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
        <h3 className="mb-4 text-sm font-semibold text-ink">Risk vs Spend Matrix</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs font-medium uppercase text-ink-3">
                <th className="pb-2 pr-4">Supplier</th>
                <th className="pb-2 pr-4">Risk Level</th>
                <th className="pb-2 pr-4 text-right">Spend (12m)</th>
                <th className="pb-2 text-right">Performance</th>
              </tr>
            </thead>
            <tbody>
              {riskSpendMatrix.map((s) => (
                <tr key={s.id} className="border-b border-line-2">
                  <td className="py-2 pr-4 font-medium text-ink">{s.name}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={cn(
                        'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                        s.riskRating === 'critical' && 'bg-stop-soft text-stop',
                        s.riskRating === 'high' && 'bg-warn-soft text-warn',
                        s.riskRating === 'medium' && 'bg-warn-soft text-warn',
                        s.riskRating === 'low' && 'bg-ok-soft text-ok',
                      )}
                    >
                      {s.riskRating}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right text-ink-2">
                    {formatCurrency(s.totalSpend12m)}
                  </td>
                  <td className="py-2 text-right font-medium text-ink">
                    {s.performanceScore > 0 ? s.performanceScore : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
