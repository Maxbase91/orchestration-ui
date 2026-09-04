import { useMemo } from 'react';
import { Sparkles, Star, AlertTriangle, CheckCircle, UserPlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAiAgent } from '@/lib/db/hooks/use-ai-agents';
import { useSuppliers, useCreateProspectiveSupplier } from '@/lib/db/hooks/use-suppliers';
import { useContracts } from '@/lib/db/hooks/use-contracts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import { SupplierAutocomplete } from './supplier-autocomplete';
import { isPreferredSupplier } from '@/lib/procurement/supplier-preference';
import { isProspective } from '@/lib/workflow/onboarding-stage';
import type { Supplier } from '@/data/types';

interface Props {
  category: string;
  estimatedValue: number;
  selectedSupplierId?: string;
  /** The supplier's name as captured, for the provenance line. */
  selectedSupplierName?: string;
  /**
   * Where the current supplier came from — a name in the demand or the chat is a
   * suggestion to confirm, not a decision the requester made.
   */
  supplierProvenance?: 'named' | 'chosen';
  /**
   * THE single place a supplier is chosen.
   *
   * Selection used to live in step-details while this card only *listed*
   * recommendations with no way to act on them — so the requester picked in one
   * place, was advised in another, and could not accept the advice. Choosing
   * here is right because everything that should inform the choice (PSL status,
   * screening, risk tier, master-data completeness) is computed on this step.
   */
  onSelect?: (supplier: Supplier) => void;
  /** Other suppliers to invite to sourcing, beside the preferred one. */
  candidateIds?: readonly string[];
  onToggleCandidate?: (supplier: Supplier) => void;
  /** Whether the requester has said they have no supplier in mind. */
  intent?: 'named' | 'to-be-sourced';
  onIntentChange?: (intent: 'named' | 'to-be-sourced') => void;
}

const EMPTY_CANDIDATES: readonly string[] = [];

type SupplierOutcome = 'preferred' | 'recommend-existing' | 'onboard-new';

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

export function SupplierRecommenderCard({
  category, estimatedValue, selectedSupplierId, selectedSupplierName,
  supplierProvenance, onSelect,
  candidateIds = EMPTY_CANDIDATES, onToggleCandidate, intent = 'named', onIntentChange,
}: Props) {
  const { data: agent } = useAiAgent('AI-005');
  const createProspective = useCreateProspectiveSupplier();
  const { data: suppliers = [] } = useSuppliers();
  const { data: contracts = [] } = useContracts();
  const active = agent?.status === 'active';

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === selectedSupplierId),
    [suppliers, selectedSupplierId],
  );

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

  // Classify the overall supplier outcome so the wizard can tell the user
  // exactly which path the request will take downstream.
  const outcome: SupplierOutcome = useMemo(() => {
    if (selectedSupplier) {
      const hasActiveContract = contracts.some(
        (c) => c.supplierId === selectedSupplier.id && (c.status === 'active' || c.status === 'expiring'),
      );
      if (isPreferredSupplier(selectedSupplier, { hasActiveContract })) {
        return 'preferred';
      }
    }
    if (recommendations.length > 0) return 'recommend-existing';
    return 'onboard-new';
  }, [selectedSupplier, contracts, recommendations]);

  const outcomeCopy: Record<SupplierOutcome, { label: string; detail: string; icon: typeof CheckCircle; color: string }> = {
    preferred: {
      label: 'Preferred supplier identified',
      detail: selectedSupplier
        ? `${selectedSupplier.name} has an active contract, ${selectedSupplier.performanceScore}% performance score, and ${selectedSupplier.riskRating} risk — sourcing can proceed as a call-off.`
        : '',
      icon: CheckCircle,
      color: 'text-green-700 bg-green-50 border-green-200',
    },
    'recommend-existing': {
      label: 'Recommended existing suppliers',
      detail: `${recommendations.length} existing supplier${recommendations.length === 1 ? '' : 's'} match the category profile — pick one below or proceed to competitive sourcing.`,
      icon: Star,
      color: 'text-blue-700 bg-blue-50 border-blue-200',
    },
    'onboard-new': {
      label: 'New supplier onboarding required',
      detail: 'No existing supplier matches the required category with acceptable performance/risk. Downstream workflow should trigger the supplier-onboarding process.',
      icon: UserPlus,
      color: 'text-amber-700 bg-amber-50 border-amber-200',
    },
  };

  // Do NOT bail when the agent is missing. This card is now the single place a
  // supplier is chosen, so returning null on a missing or disabled AI-005 would
  // leave the requester with no way to pick one at all. The recommendations are
  // the part that depends on the agent; the selection is not.
  if (!agent && !onSelect) return null;

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="size-4 text-[#2D5F8A]" />
          Supplier
        </CardTitle>
        <span className="text-[11px] text-gray-400">
          {!agent
            ? 'Recommender unavailable'
            : active
              ? `${agent.name} (AI-005) · accuracy ${agent.accuracy}%`
              : `${agent.name} is ${agent.status}`}
        </span>
      </CardHeader>
      <CardContent>
        {/* The single selection point. Earlier steps pre-fill it; a supplier
            named in the demand or matched in the chat arrives here as a
            suggestion to confirm, with its provenance stated, rather than as a
            second decision the requester has already made somewhere else. */}
        {onSelect && (
          <div className="mb-4 space-y-1.5">
            <p className="text-xs font-medium text-gray-700">Selected supplier</p>
            <SupplierAutocomplete
              value={selectedSupplierName ?? ''}
              supplierId={selectedSupplierId ?? ''}
              onSelect={onSelect}
              onCreateProspective={async (name) => {
                const created = await createProspective.mutateAsync({ name });
                onSelect(created);
              }}
            />
            {/* A prospective supplier changes what happens next, so it is stated
                here rather than discovered at the sourcing or contracting gate. */}
            {selectedSupplier && isProspective(selectedSupplier) && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
                New supplier — screening must clear before they can be invited to a
                sourcing event or the risk assessment completed, and full onboarding is
                required before contracting.
              </p>
            )}
            {selectedSupplierId && supplierProvenance === 'named' && (
              <p className="text-[11px] text-gray-500">
                Taken from your request — confirm or change it here.
              </p>
            )}
            {!selectedSupplierId && intent === 'named' && (
              <p className="text-[11px] text-gray-500">
                No supplier selected yet. Pick one, or say you have none in mind.
              </p>
            )}
            {/* An explicit choice, not an empty field. Leaving the supplier
                blank was the only way to say "go out to market", which reads as
                something the requester forgot rather than something they
                decided — and gave them no confirmation it had registered. */}
            {onIntentChange && (
              intent === 'to-be-sourced' ? (
                <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-blue-100 bg-blue-50/60 px-3 py-2">
                  <p className="text-xs text-blue-900">
                    No supplier in mind — sourcing will identify candidates.
                  </p>
                  <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => onIntentChange('named')}>
                    I do have one
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 h-7 text-[11px]"
                  onClick={() => onIntentChange('to-be-sourced')}
                >
                  I have none in mind — go out to market
                </Button>
              )
            )}
          </div>
        )}

        {active && (() => {
          const cfg = outcomeCopy[outcome];
          const Icon = cfg.icon;
          return (
            <div className={`mb-3 flex items-start gap-2 rounded-md border p-3 ${cfg.color}`}>
              <Icon className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="text-sm font-medium">{cfg.label}</p>
                <p className="mt-0.5 text-xs opacity-80">{cfg.detail}</p>
              </div>
            </div>
          );
        })()}
        {!active ? (
          <p className="text-sm text-gray-500">
            {agent
              ? `Supplier recommender is ${agent.status}. Enable it in Admin → AI Agents to see ranked supplier suggestions for ${category || 'the selected category'}.`
              : 'Supplier recommender is not configured, so no ranked suggestions are shown. You can still select a supplier above.'}
          </p>
        ) : recommendations.length === 0 ? (
          <p className="text-sm text-gray-500">
            {outcome === 'preferred'
              ? 'Selected supplier is preferred — no alternate suggestions needed.'
              : 'No matching existing suppliers with performance history in this category.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {recommendations.map(({ supplier, score }) => (
              <li
                key={supplier.id}
                className={cn(
                  'flex items-center justify-between rounded-md border p-3',
                  supplier.id === selectedSupplierId
                    ? 'border-blue-300 bg-blue-50/50'
                    : 'border-gray-200',
                )}
              >
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
                  {/* A recommendation you cannot act on is not a recommendation.
                      This card previously listed suppliers with no way to pick
                      one, while selection lived two steps earlier. */}
                  {onSelect && (
                    supplier.id === selectedSupplierId ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-blue-700">
                        <CheckCircle className="size-3.5" /> Preferred
                      </span>
                    ) : (
                      <div className="flex items-center gap-1">
                        {/* Several candidates go to sourcing; exactly one is
                            preferred, because screening, risk reuse and
                            contract coverage need a single subject. */}
                        {onToggleCandidate && (
                          <Button
                            size="sm"
                            variant={candidateIds.includes(supplier.id) ? 'secondary' : 'ghost'}
                            className="h-7 text-[11px]"
                            onClick={() => onToggleCandidate(supplier)}
                          >
                            {candidateIds.includes(supplier.id) ? 'Invited' : 'Also invite'}
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => onSelect(supplier)}>
                          Prefer
                        </Button>
                      </div>
                    )
                  )}
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
