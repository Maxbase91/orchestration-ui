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
import { isPreferredSupplier, isPreferredSupplierOverride } from '@/lib/procurement/supplier-preference';
import { usePolicyConfig } from '@/lib/procurement/use-policy-config';
import { Textarea } from '@/components/ui/textarea';
import { isProspective } from '@/lib/workflow/onboarding-stage';
import { useProcurementCategories } from '@/lib/db/hooks/use-procurement-categories';
import { usePreferredSupplierIds } from '@/lib/db/hooks/use-category-preferred-suppliers';
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
  /** Why this supplier rather than a preferred one — asked only on an override. */
  overrideReason?: string;
  onOverrideReasonChange?: (reason: string) => void;
}

const EMPTY_CANDIDATES: readonly string[] = [];

type SupplierOutcome = 'preferred' | 'recommend-existing' | 'onboard-new';

/**
 * How well a supplier's capabilities cover a category: the share of the
 * category's supplier tags it carries.
 *
 * The tags are the category's own (/admin/categories → "Supplier tags that
 * cover this category"). They were a hard-coded category → keyword map here,
 * so a new category matched no supplier until someone edited this file.
 */
function categoryMatchScore(supplier: Supplier, tags: readonly string[]): number {
  if (tags.length === 0) return 0;
  const caps = (supplier.categories ?? []).map((c) => c.toLowerCase());
  let hits = 0;
  for (const tag of tags) {
    if (caps.some((cap) => cap.includes(tag.toLowerCase()))) hits += 1;
  }
  return hits / tags.length; // 0..1
}

const RISK_WEIGHT: Record<string, number> = {
  low: 1.0, medium: 0.8, high: 0.5, critical: 0.0,
};

export function SupplierRecommenderCard({
  category, estimatedValue, selectedSupplierId, selectedSupplierName,
  supplierProvenance, onSelect,
  candidateIds = EMPTY_CANDIDATES, onToggleCandidate, intent = 'named', onIntentChange,
  overrideReason = '', onOverrideReasonChange,
}: Props) {
  const { preferredSupplierOverrideNeedsApproval } = usePolicyConfig();
  const { data: agent } = useAiAgent('AI-005');
  const createProspective = useCreateProspectiveSupplier();
  const { data: suppliers = [] } = useSuppliers();
  const { data: contracts = [] } = useContracts();
  const { data: categories = [] } = useProcurementCategories();
  const preferredIds = usePreferredSupplierIds(category);
  const tags = useMemo(() => categories.find((c) => c.id === category)?.supplierTags ?? [], [categories, category]);
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
        // A preferred supplier for the category is a full match whatever its tags say.
        const match = preferredIds.includes(s.id) ? 1 : categoryMatchScore(s, tags);
        const riskFactor = RISK_WEIGHT[s.riskRating] ?? 0.5;
        // Composite: category fit × performance × risk
        const score = match * (s.performanceScore / 100) * riskFactor;
        return { supplier: s, score, match };
      })
      .filter((r) => r.match > 0)
      // Preferred suppliers first, then by score.
      .sort((a, b) => Number(preferredIds.includes(b.supplier.id)) - Number(preferredIds.includes(a.supplier.id)) || b.score - a.score)
      .slice(0, 3);
    return scored;
  }, [active, suppliers, category, selectedSupplierId, preferredIds, tags]);

  // Classify the overall supplier outcome so the wizard can tell the user
  // exactly which path the request will take downstream.
  const outcome: SupplierOutcome = useMemo(() => {
    if (selectedSupplier) {
      const hasActiveContract = contracts.some(
        (c) => c.supplierId === selectedSupplier.id && (c.status === 'active' || c.status === 'expiring'),
      );
      if (isPreferredSupplier(selectedSupplier, { hasActiveContract, preferredIds })) {
        return 'preferred';
      }
    }
    if (recommendations.length > 0) return 'recommend-existing';
    return 'onboard-new';
  }, [selectedSupplier, contracts, recommendations, preferredIds]);

  const outcomeCopy: Record<SupplierOutcome, { label: string; detail: string; icon: typeof CheckCircle; color: string }> = {
    preferred: {
      label: 'Preferred supplier identified',
      detail: selectedSupplier
        ? `${selectedSupplier.name} has an active contract, ${selectedSupplier.performanceScore}% performance score, and ${selectedSupplier.riskRating} risk — sourcing can proceed as a call-off.`
        : '',
      icon: CheckCircle,
      color: 'text-ok bg-ok-soft border-ok-line',
    },
    'recommend-existing': {
      label: 'Recommended existing suppliers',
      detail: `${recommendations.length} existing supplier${recommendations.length === 1 ? '' : 's'} match the category profile — pick one below or proceed to competitive sourcing.`,
      icon: Star,
      color: 'text-accent-solid bg-accent-soft border-accent-line',
    },
    'onboard-new': {
      label: 'New supplier onboarding required',
      detail: 'No existing supplier matches the required category with acceptable performance/risk. Downstream workflow should trigger the supplier-onboarding process.',
      icon: UserPlus,
      color: 'text-warn bg-warn-soft border-warn-line',
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
          <Sparkles className="size-4 text-accent" />
          Supplier
        </CardTitle>
        <span className="text-[11px] text-ink-3">
          {/* No accuracy figure: the stored one (78.6%) was measured by
              nothing, and the ranking is category fit × performance × risk,
              which is what this now says. */}
          {!agent
            ? 'Suggestions unavailable'
            : active
              ? 'Suggested by category fit, performance and risk'
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
            <p className="text-xs font-medium text-ink-2">Selected supplier</p>
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
              <p className="rounded-md border border-warn-line bg-warn-soft px-2 py-1.5 text-[11px] text-warn">
                New supplier — screening must clear before they can be invited to a
                sourcing event or the risk assessment completed, and full onboarding is
                required before contracting.
              </p>
            )}
            {selectedSupplierId && supplierProvenance === 'named' && (
              <p className="text-[11px] text-ink-3">
                Taken from your request — confirm or change it here.
              </p>
            )}
            {/* A supplier outside the category's preferred list is allowed, but
                it has to be explained — and, when Decisioning thresholds say so,
                agreed by a category manager. Asked here, where the choice is
                made; the server recomputes the override and refuses without it. */}
            {isPreferredSupplierOverride(selectedSupplierId, preferredIds) && onOverrideReasonChange && (
              <div className="space-y-1.5 rounded-md border border-warn-line bg-warn-soft px-2.5 py-2">
                <label htmlFor="supplier-override-reason" className="block text-[11px] font-medium text-warn">
                  Not on the preferred list for this category — why this supplier?
                </label>
                <Textarea
                  id="supplier-override-reason"
                  rows={2}
                  className="bg-card text-sm"
                  value={overrideReason}
                  onChange={(e) => onOverrideReasonChange(e.target.value)}
                  placeholder="e.g. the only supplier with the certification this work needs"
                />
                <p className="text-[11px] text-ink-3">
                  {preferredSupplierOverrideNeedsApproval
                    ? 'A category manager approves this choice before the request moves on.'
                    : 'Recorded on the request beside the supplier.'}
                </p>
              </div>
            )}
            {!selectedSupplierId && intent === 'named' && (
              <p className="text-[11px] text-ink-3">
                No supplier selected yet. Pick one, or say you have none in mind.
              </p>
            )}
            {/* An explicit choice, not an empty field. Leaving the supplier
                blank was the only way to say "go out to market", which reads as
                something the requester forgot rather than something they
                decided — and gave them no confirmation it had registered. */}
            {onIntentChange && (
              intent === 'to-be-sourced' ? (
                <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-accent-line bg-accent-soft/60 px-3 py-2">
                  <p className="text-xs text-accent-solid">
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
          <p className="text-sm text-ink-3">
            {agent
              ? `Supplier recommender is ${agent.status}. Enable it in Admin → AI Agents to see ranked supplier suggestions for ${category || 'the selected category'}.`
              : 'Supplier recommender is not configured, so no ranked suggestions are shown. You can still select a supplier above.'}
          </p>
        ) : recommendations.length === 0 ? (
          <p className="text-sm text-ink-3">
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
                    ? 'border-accent-line bg-accent-soft/50'
                    : 'border-line',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink truncate">{supplier.name}</p>
                  <p className="text-xs text-ink-3">
                    {supplier.country} · {supplier.activeContracts} active contract(s) · {formatCurrency(supplier.totalSpend12m)} YTD
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="flex items-center gap-1 text-xs text-ink-2">
                    <Star className="size-3 text-warn" />
                    {supplier.performanceScore}
                  </span>
                  {supplier.riskRating === 'high' || supplier.riskRating === 'critical' ? (
                    <span className="flex items-center gap-1 text-xs text-stop">
                      <AlertTriangle className="size-3" />
                      {supplier.riskRating}
                    </span>
                  ) : (
                    <span className="text-xs text-ink-3">{supplier.riskRating}</span>
                  )}
                  <span className="text-[11px] text-ink-3">
                    fit {(score * 100).toFixed(0)}%
                  </span>
                  {/* A recommendation you cannot act on is not a recommendation.
                      This card previously listed suppliers with no way to pick
                      one, while selection lived two steps earlier. */}
                  {onSelect && (
                    supplier.id === selectedSupplierId ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-accent-solid">
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
        <p className="mt-3 text-[11px] text-ink-3">
          Ranked by category fit × performance score × risk weight · est. value {formatCurrency(estimatedValue)}
        </p>
      </CardContent>
    </Card>
  );
}
