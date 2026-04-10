import { AISuggestionCard } from '@/components/shared/ai-suggestion-card';

export function WidgetAIInsights() {
  return (
    <AISuggestionCard
      title="Strategic Insights"
      confidence={91}
      showExplanation
      explanation="Based on analysis of current request pipeline, supplier SRA dates, and historical demand patterns."
    >
      <ul className="space-y-2 list-none">
        <li className="flex items-start gap-2">
          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-amber-400" />
          <span>3 requests have been in validation for over 5 days.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-red-400" />
          <span>2 suppliers have expiring SRAs this month.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-blue-400" />
          <span>Demand for IT consulting is 40% above forecast.</span>
        </li>
      </ul>
    </AISuggestionCard>
  );
}
