import { useMemo } from 'react';
import { Sparkles, Star, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAiAgent } from '@/lib/db/hooks/use-ai-agents';
import { useSuppliers } from '@/lib/db/hooks/use-suppliers';
import { formatCurrency } from '@/lib/format';
import type { Supplier } from '@/data/types';

interface Props {
  category: string;
  estimatedValue: number;
  selectedSupplierId?: string;
}

// Map a request category to the supplier-side category tags we expect to
// find in suppliers.categories[]. The admin can extend this by adding
// category tags to suppliers directly.
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  goods: ['Hardware', 'Equipment', 'Goods'],
  services: ['Services', 'Facilities', 'Marketing'],
  software: ['Software', 'Cloud', 'SaaS', 'Licensing'],
  consulting: ['Consulting', 'Advisory', 'Strategy', 'Transformation'],
  'contingent-labour': ['Contingent Labour', 'Staffing', 'Recruitment'],
  'contract-renewal': ['Software Licensing', 'Cloud Services', 'Managed Services'],
  'supplier-onboarding': [],
};

function categoryMatchScore(supplier: Supplier, category: string): number {
  const keywords = CATEGORY_KEYWORDS[category] ?? [];
  if (keywords.length === 0) return 0;
  const tags = (supplier.categories ?? []).map((c) => c.toLowerCase());
  let hits = 0;
  for (const kw of keywords) {
    if (tags.some((t) => t.includes(kw.toLowerCase()))) hits += 1;
  }
  return hits / keywords.length; // 0..1
}

const RISK_WEIGHT: Record<string, number> = {
  low: 1.0, medium: 0.8, high: 0.5, critical: 0.0,
};

export function SupplierRecommenderCard({ category, estimatedValue, selectedSupplierId }: Props) {
  const { data: agent } = useAiAgent('AI-005');
  const { data: suppliers = [] } = useSuppliers();
  const active = agent?.status === 'active';

  const recommendations = useMemo(() => {
    if (!active || !category) return [];
    const scored = suppliers
      .filter((s) => s.id !== selectedSupplierId && s.performanceScore > 0)
      .map((s) => {
        const match = categoryMatchScore(s, category);
        const riskFactor = RISK_WEIGHT[s.riskRating] ?? 0.5;
        // Composite: category fit × performance × risk
        const score = match * (s.performanceScore / 100) * riskFactor;
        return { supplier: s, score, match };
      })
      .filter((r) => r.match > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    return scored;
  }, [active, suppliers, category, selectedSupplierId]);

  if (!agent) return null;

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="size-4 text-[#2D5F8A]" />
          Recommended Suppliers
        </CardTitle>
        <span className="text-[11px] text-gray-400">
          {active
            ? `${agent.name} (AI-005) · accuracy ${agent.accuracy}%`
            : `${agent.name} is ${agent.status}`}
        </span>
      </CardHeader>
      <CardContent>
        {!active ? (
          <p className="text-sm text-gray-500">
            Supplier recommender is {agent.status}. Enable it in Admin → AI Agents to see ranked
            supplier suggestions for {category || 'the selected category'}.
          </p>
        ) : recommendations.length === 0 ? (
          <p className="text-sm text-gray-500">
            No matching suppliers with performance history in this category.
          </p>
        ) : (
          <ul className="space-y-2">
            {recommendations.map(({ supplier, score }) => (
              <li key={supplier.id} className="flex items-center justify-between rounded-md border border-gray-200 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{supplier.name}</p>
                  <p className="text-xs text-gray-500">
                    {supplier.country} · {supplier.activeContracts} active contract(s) · {formatCurrency(supplier.totalSpend12m)} YTD
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="flex items-center gap-1 text-xs text-gray-600">
                    <Star className="size-3 text-amber-500" />
                    {supplier.performanceScore}
                  </span>
                  {supplier.riskRating === 'high' || supplier.riskRating === 'critical' ? (
                    <span className="flex items-center gap-1 text-xs text-red-600">
                      <AlertTriangle className="size-3" />
                      {supplier.riskRating}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">{supplier.riskRating}</span>
                  )}
                  <span className="text-[11px] text-gray-400">
                    fit {(score * 100).toFixed(0)}%
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-gray-400">
          Ranked by category fit × performance score × risk weight · est. value {formatCurrency(estimatedValue)}
        </p>
      </CardContent>
    </Card>
  );
}
