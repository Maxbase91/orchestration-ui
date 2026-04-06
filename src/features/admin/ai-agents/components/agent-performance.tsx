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
  const overrideRate = Math.round((100 - agent.accuracy) * 0.8 * 10) / 10;

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-gray-900">Performance Dashboard</h4>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{agent.accuracy}%</p>
          <p className="text-xs text-gray-500">Current Accuracy</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{overrideRate}%</p>
          <p className="text-xs text-gray-500">Override Rate</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{agent.decisionsMade.toLocaleString()}</p>
          <p className="text-xs text-gray-500">Total Decisions</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-gray-500">Accuracy Trend (6 months)</CardTitle>
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
          <CardTitle className="text-xs font-medium text-gray-500">Decisions per Day</CardTitle>
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
          <CardTitle className="text-xs font-medium text-gray-500">Most Common Corrections (Top 5)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {COMMON_CORRECTIONS.map((item, i) => (
              <div key={i} className="flex items-center justify-between rounded bg-gray-50 px-3 py-2">
                <span className="text-xs text-gray-700">{item.correction}</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
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
