// Performance dashboard for a single AI agent (admin > AI agents detail view).
// There is no per-day telemetry store in R1, so trend/volume series are
// illustrative, derived from the agent's headline accuracy figure.

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChartWidget } from '@/components/charts/line-chart-widget';
import { BarChartWidget } from '@/components/charts/bar-chart-widget';
import type { AIAgent } from '@/data/types';

function generateAccuracyData(baseAccuracy: number) {
  const months = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'];
  return months.map((name, i) => ({
    name,
    accuracy: Math.round((baseAccuracy - 5 + i * 1.2 + Math.random() * 2) * 10) / 10,
  }));
}

function generateDecisionsData() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map((name) => ({
    name,
    value: Math.floor(Math.random() * 40 + 10),
    decisions: Math.floor(Math.random() * 40 + 10),
  }));
}

const COMMON_CORRECTIONS = [
  { correction: 'Software misclassified as Services', count: 23 },
  { correction: 'Incorrect commodity code assignment', count: 18 },
  { correction: 'Value extraction off by >10%', count: 14 },
  { correction: 'Missing supplier identification', count: 11 },
  { correction: 'False positive duplicate detection', count: 8 },
];

interface AgentPerformanceProps {
  agent: AIAgent;
}

export function AgentPerformance({ agent }: AgentPerformanceProps) {
  const accuracyData = generateAccuracyData(agent.accuracy);
  const decisionsData = generateDecisionsData();
  // Heuristic: humans override most, but not all, wrong decisions — so the
  // override rate is modelled as 80% of the error rate.
  const overrideRate = Math.round((100 - agent.accuracy) * 0.8 * 10) / 10;

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-ink">Performance Dashboard</h4>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-card p-3 text-center">
          <p className="text-2xl font-bold text-ink">{agent.accuracy}%</p>
          <p className="text-xs text-ink-3">Current Accuracy</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-3 text-center">
          <p className="text-2xl font-bold text-ink">{overrideRate}%</p>
          <p className="text-xs text-ink-3">Override Rate</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-3 text-center">
          <p className="text-2xl font-bold text-ink">{agent.decisionsMade.toLocaleString()}</p>
          <p className="text-xs text-ink-3">Total Decisions</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-ink-3">Accuracy Trend (6 months)</CardTitle>
        </CardHeader>
        <CardContent>
          <LineChartWidget
            data={accuracyData}
            dataKeys={[{ key: 'accuracy', color: '#3B82F6', label: 'Accuracy %' }]}
            height={200}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-ink-3">Decisions per Day</CardTitle>
        </CardHeader>
        <CardContent>
          <BarChartWidget
            data={decisionsData}
            dataKeys={[{ key: 'decisions', color: '#8B5CF6', label: 'Decisions' }]}
            height={200}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-ink-3">Most Common Corrections (Top 5)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {COMMON_CORRECTIONS.map((item, i) => (
              <div key={i} className="flex items-center justify-between rounded bg-card-2 px-3 py-2">
                <span className="text-xs text-ink-2">{item.correction}</span>
                <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">
                  {item.count}x
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
