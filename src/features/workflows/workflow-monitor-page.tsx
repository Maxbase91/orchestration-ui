import { useMemo } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { AISuggestionCard } from '@/components/shared/ai-suggestion-card';
import { useRequests } from '@/lib/db/hooks/use-requests';
import type { RequestStatus } from '@/data/types';
import { BottleneckChart } from './components/bottleneck-chart';
import { StuckRequestsTable } from './components/stuck-requests-table';
import { HeatmapView } from './components/heatmap-view';
import { AIBottleneckAnalysis } from './components/ai-bottleneck-analysis';
import { SLATracker } from './components/sla-tracker';

const ACTIVE_STATUSES = new Set<RequestStatus>([
  'intake',
  'validation',
  'approval',
  'sourcing',
  'contracting',
  'po',
  'receipt',
  'invoice',
  'payment',
]);

const STAGE_LABELS: Record<string, string> = {
  intake: 'Intake',
  validation: 'Validation',
  approval: 'Approval',
  sourcing: 'Sourcing',
  contracting: 'Contracting',
  po: 'PO',
  receipt: 'Receipt',
  invoice: 'Invoice',
  payment: 'Payment',
};

export function WorkflowMonitorPage() {
  const { data: requests = [] } = useRequests();
  const activeRequests = useMemo(
    () => requests.filter((r) => ACTIVE_STATUSES.has(r.status)),
    [requests],
  );

  // Calculate the #1 bottleneck stage
  const bottleneck = useMemo(() => {
    const stageStats: Record<string, { total: number; count: number }> = {};

    for (const req of activeRequests) {
      if (!stageStats[req.status]) {
        stageStats[req.status] = { total: 0, count: 0 };
      }
      stageStats[req.status].total += req.daysInStage;
      stageStats[req.status].count += 1;
    }

    let worstStage = '';
    let worstAvg = 0;
    let worstCount = 0;

    for (const [stage, stats] of Object.entries(stageStats)) {
      const avg = stats.count > 0 ? stats.total / stats.count : 0;
      if (avg > worstAvg) {
        worstAvg = avg;
        worstStage = stage;
        worstCount = stats.count;
      }
    }

    return {
      stage: STAGE_LABELS[worstStage] ?? worstStage,
      count: worstCount,
      avgDays: Math.round(worstAvg * 10) / 10,
    };
  }, [activeRequests]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflow Monitor & Bottlenecks"
        subtitle="Identify pipeline bottlenecks, stuck requests, and SLA risks"
      />

      {/* Top Bottleneck AI Card */}
      <AISuggestionCard
        title="Top Bottleneck Identified"
        confidence={0.93}
      >
        <p>
          <strong>{bottleneck.stage}</strong> is the #1 bottleneck this month.{' '}
          {bottleneck.count} request{bottleneck.count !== 1 ? 's' : ''} averaging{' '}
          <strong>{bottleneck.avgDays} days</strong> (SLA target: 5 days).
        </p>
      </AISuggestionCard>

      {/* Bottleneck Chart */}
      <BottleneckChart requests={activeRequests} />

      {/* Stuck Requests Table */}
      <StuckRequestsTable requests={activeRequests} />

      {/* Heatmap */}
      <HeatmapView requests={activeRequests} />

      {/* AI Bottleneck Analysis */}
      <AIBottleneckAnalysis />

      {/* SLA Tracker */}
      <SLATracker requests={activeRequests} />
    </div>
  );
}
