import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChartWidget } from '@/components/charts/bar-chart-widget';
import { PieChartWidget } from '@/components/charts/pie-chart-widget';
import { AISuggestionCard } from '@/components/shared/ai-suggestion-card';
import type { Supplier } from '@/data/types';

interface ProfileSpendTabProps {
  supplier: Supplier;
}

export function ProfileSpendTab({ supplier }: ProfileSpendTabProps) {
  const barData = supplier.spendHistory.map((h) => ({
    name: String(h.year),
    value: h.amount,
  }));

  // Mock spend by category
  const categories = supplier.categories.slice(0, 4);
  const totalSpend = supplier.totalSpend12m || 1;
  const pieData = categories.map((cat, i) => {
    const weights = [0.45, 0.25, 0.18, 0.12];
    return {
      name: cat,
      value: Math.round(totalSpend * (weights[i] ?? 0.1)),
    };
  });

  const lastYear = supplier.spendHistory[supplier.spendHistory.length - 2]?.amount ?? 0;
  const thisYear = supplier.spendHistory[supplier.spendHistory.length - 1]?.amount ?? 0;
  const yoyChange = lastYear > 0 ? Math.round(((thisYear - lastYear) / lastYear) * 100) : 0;
  const direction = yoyChange > 0 ? 'increased' : yoyChange < 0 ? 'decreased' : 'remained flat';

  return (
    <div className="space-y-6">
      <AISuggestionCard title="Spend Insight" confidence={0.85}>
        <p>
          Spend with {supplier.name} has {direction} {Math.abs(yoyChange)}% year-over-year.
          {yoyChange > 15
            ? ' Consider reviewing consolidation opportunities or volume discounts.'
            : yoyChange < -10
              ? ' Investigate whether reduced spend reflects strategic decisions or quality concerns.'
              : ''}
        </p>
      </AISuggestionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="py-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Spend by Year</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChartWidget
              data={barData}
              dataKeys={[{ key: 'value', color: '#1B2A4A', label: 'Spend' }]}
              height={260}
            />
          </CardContent>
        </Card>

        <Card className="py-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Spend by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {supplier.totalSpend12m > 0 ? (
              <PieChartWidget data={pieData} height={260} innerRadius={50} />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No spend recorded for this supplier.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
