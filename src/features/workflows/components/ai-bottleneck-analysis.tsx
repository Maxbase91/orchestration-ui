import { AISuggestionCard } from '@/components/shared/ai-suggestion-card';

export function AIBottleneckAnalysis() {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">
        AI Bottleneck Analysis
      </h3>

      <div className="grid gap-3 md:grid-cols-1 lg:grid-cols-3">
        <AISuggestionCard
          title="Finance team overloaded"
          confidence={0.91}
          showExplanation
          explanation="Based on approval queue depth and average response times over the past 30 days. Robert Fischer (u8) has been OOO since Jan 2, with no delegate actively processing his queue."
        >
          <p>
            Finance team has 15 pending approvals. 8 are from Robert Fischer
            who has been out of office since 02 Jan. Suggest: reassign to
            delegate Dr. Katrin Bauer.
          </p>
        </AISuggestionCard>

        <AISuggestionCard
          title="Sourcing stage slowdown"
          confidence={0.87}
          showExplanation
          explanation="Comparing 30-day rolling average to 90-day baseline. 60% of sourcing requests are missing mandatory supplier risk assessment data, requiring additional follow-up loops."
        >
          <p>
            Sourcing stage has increased from 5-day average to 9 days this
            month. Root cause: 60% of requests are missing supplier risk
            data, causing re-work and delays.
          </p>
        </AISuggestionCard>

        <AISuggestionCard
          title="DVMO validation queue backlog"
          confidence={0.94}
          showExplanation
          explanation="Queue depth calculated from validation-stage request count. Throughput rate based on 14-day rolling average of validation completions (4 per day). ETA = 22 / 4 = 5.5 working days."
        >
          <p>
            DVMO validation queue has 22 items. At current throughput (4/day),
            this will take 5.5 working days to clear. Consider temporary
            resource allocation.
          </p>
        </AISuggestionCard>
      </div>
    </div>
  );
}
