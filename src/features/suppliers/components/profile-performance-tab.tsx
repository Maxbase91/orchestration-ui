import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KPICard } from '@/components/shared/kpi-card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { Supplier } from '@/data/types';

interface ProfilePerformanceTabProps {
  supplier: Supplier;
}

function generatePerformanceTrend(baseScore: number) {
  const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months.map((month, i) => ({
    month,
    score: Math.max(0, Math.min(100, baseScore + Math.round((i - 2) * 1.5 + (Math.sin(i) * 3)))),
  }));
}

export function ProfilePerformanceTab({ supplier }: ProfilePerformanceTabProps) {
  const score = supplier.performanceScore;
  const trendData = generatePerformanceTrend(score);

  // Derive sub-scores from overall score
  const delivery = Math.min(100, score + 3);
  const quality = Math.min(100, score - 2);
  const responsiveness = Math.min(100, score + 1);
  const innovation = Math.max(0, score - 8);

  if (score === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">
          No performance data available for this supplier yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard
          label="Delivery On Time"
          value={delivery}
          format="percentage"
          trend={{ direction: delivery >= 80 ? 'up' : 'down', percentage: 2.1 }}
        />
        <KPICard
          label="Quality"
          value={quality}
          format="percentage"
          trend={{ direction: quality >= 80 ? 'up' : 'down', percentage: 1.4 }}
        />
        <KPICard
          label="Responsiveness"
          value={responsiveness}
          format="percentage"
          trend={{ direction: 'up', percentage: 3.2 }}
        />
        <KPICard
          label="Innovation"
          value={innovation}
          format="percentage"
          trend={{ direction: innovation >= 70 ? 'up' : 'flat', percentage: 0.8 }}
        />
      </div>

      <Card className="py-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Performance Trend (6 months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#718096' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#718096' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #E2E8F0',
                  borderRadius: 6,
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#1B2A4A"
                strokeWidth={2}
                dot={{ fill: '#1B2A4A', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
