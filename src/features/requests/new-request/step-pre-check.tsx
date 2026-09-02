// Staged-intake funnel (INT-10) — the screen where a demand is recognised as a
// catalogue order, a call-off against an existing contract, or new demand.
//
// This is now a *presenter*. The decision itself lives in
// `lib/procurement/intake-routing.ts`, which is pure and benchmarked; the
// scoring used to be three `useMemo`s in here, which meant no test could reach
// it and nothing could explain a route.
//
// Two behaviours changed for a reason worth recording, because both look like
// polish and are not:
//
//  * When the catalogue cannot serve the demand's category, its stage is
//    **skipped and the reason shown**, rather than rendered empty. The funnel
//    previously offered a consulting demand a box of business cards, and the
//    silence afterwards was as unhelpful as the wrong suggestion.
//  * **All three destinations are reachable from every stage.** Before, a
//    catalogue match hid the enrichment block and offered no route to "this is
//    new demand" at all, so a wrong match didn't just mislead — it hid the
//    correct path behind a large green button pointing the other way.
//
// It now also shows the BUYING CHANNEL. That decision — a two-day catalogue
// order versus a multi-week procurement-led exercise — was first visible on
// step 5, four steps after it became knowable: by the end of this screen nine
// of the ten live routing rules are fully determined, and the pre-check settles
// the contract question that is the tenth input. The channel is resolved by
// `resolveDemandChannel`, the same function the determination calls, so the two
// screens cannot disagree.

import { useEffect, useMemo, useState } from 'react';
import { ShoppingCart, FileText, ArrowRight, ArrowLeft, Check, Loader2, Info, Route } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/format';
import { useSourceData } from '@/lib/integrations';
import { useProcurementCategories } from '@/lib/db/hooks/use-procurement-categories';
import { DEFAULT_CATEGORY_TAXONOMY } from '@/data/category-taxonomy';
import { decideIntakeRoute } from '@/lib/procurement/intake-routing';
import { useRoutingRules } from '@/lib/db/hooks/use-routing-rules';
import { buyingChannelLabel } from '@/lib/routing/evaluate-routing-rules';
import { resolveDemandChannel } from '@/lib/routing/demand-channel';
import { computeDemandSignals } from '@/lib/procurement/demand-signals';
import { requestContractMatch } from '@/lib/procurement/contract-match-api';
import type { CatalogueItem } from '@/data/catalogue-items';
import type { Contract, ContractMatchResponse, Supplier } from '@/data/types';

export type PreCheckOutcome = 'catalogue' | 'contract' | 'full-request';

interface StepPreCheckProps {
  title: string;
  category: string;
  estimatedValue: number;
  supplierId: string;
  /** api/ai.ts `intent` from step 1 — authoritative when it can be honoured. */
  llmIntent?: string;
  onChooseCatalogue: (items: CatalogueItem[]) => void;
  onChooseContract: (contract: Contract, supplier: Supplier | undefined) => void;
  onProceedToFullRequest: () => void;
  /** Carry enrichment text forward so the full SD / second contract check benefit. */
  onEnrich?: (text: string) => void;
}

type Stage = 'catalogue' | 'contract';

// Category-specific guidance so "Tell us a bit more" asks for the detail that
// actually distinguishes one contract from another — not a generic prompt.
const ENRICH_GUIDANCE: Record<string, string> = {
  consulting: 'e.g. the focus area (IT strategy, operating model, finance), expected duration, and team size',
  services: 'e.g. the service type, region/sites covered, duration, and SLA expectations',
  software: 'e.g. the product or area, number of users/licences, hosting, and contract term',
  'contingent-labour': 'e.g. the role, seniority, number of people, and engagement length',
  goods: 'e.g. the items, quantity, key specifications, and delivery location',
  'contract-renewal': 'e.g. the existing supplier/contract, the term to renew, and any scope change',
};
const enrichGuidance = (category: string) =>
  ENRICH_GUIDANCE[category] ?? 'e.g. the scope, region, duration, and approximate size';

/**
 * What this demand is heading for, and how long that takes.
 *
 * Shown on both stages. The channel is whatever the route currently settled on
 * implies: a catalogue order and a call-off are channels in their own right, so
 * they are stated directly; new demand is resolved through the routing rules,
 * with `contractId` now known — which is what makes it worth resolving here
 * rather than guessing at step 1.
 */
function ChannelPanel({
  channelLabel, timelineDays, decidedBy, note,
}: {
  channelLabel: string;
  timelineDays?: number;
  /** The rule that decided it, or how it was decided when no rule matched. */
  decidedBy: string;
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-4">
      <div className="flex items-start gap-2.5">
        <Route className="mt-0.5 size-4 shrink-0 text-[#2D5F8A]" />
        <div className="flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
            Buying channel
          </p>
          <p className="text-sm font-semibold text-gray-900">
            {channelLabel}
            {timelineDays !== undefined && (
              <span className="ml-2 text-xs font-normal text-gray-500">
                typically ~{timelineDays} days
              </span>
            )}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-500">Decided by {decidedBy}.</p>
          {note && <p className="mt-1 text-[11px] text-gray-500">{note}</p>}
        </div>
      </div>
    </div>
  );
}

/** The always-available escape to a full request, on every stage. */
function ProceedPanel({ lead, onProceed }: { lead: string; onProceed: () => void }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-700">
        {lead} You&apos;ll need a full procurement request — we&apos;ll collect a service
        description, identify suppliers, and assess risk before routing.
      </p>
      <Button variant="outline" className="mt-3" onClick={onProceed}>
        Proceed to full request
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}

export function StepPreCheck({
  title, category, estimatedValue, supplierId, llmIntent,
  onChooseCatalogue, onChooseContract, onProceedToFullRequest, onEnrich,
}: StepPreCheckProps) {
  // Reads go through the standardised source-connector layer (own store today,
  // live source later) rather than directly to the data layer.
  const { data: catalogueItems = [], isLoading: catLoading, isError: catError } =
    useSourceData<CatalogueItem>('catalogue-item');
  const { data: contracts = [], isLoading: conLoading, isError: conError } =
    useSourceData<Contract>('contract');
  const { data: suppliers = [] } = useSourceData<Supplier>('supplier');
  const { data: dbCategories = [] } = useProcurementCategories();
  const { data: routingRules = [] } = useRoutingRules();

  const [enrich, setEnrich] = useState('');
  const [serverMatch, setServerMatch] = useState<ContractMatchResponse | null>(null);
  const [matchUnavailable, setMatchUnavailable] = useState(false);
  const [clarificationRound, setClarificationRound] = useState(0);
  /** Set when the user overrides the recommendation to look anyway. */
  const [forcedStage, setForcedStage] = useState<Stage | null>(null);

  // Debounce the server match while the requester types clarification detail.
  // The local matcher remains available as a responsive preview if the API is down.
  useEffect(() => {
    if (!title.trim() || conLoading || conError) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void requestContractMatch({ text: `${title} ${enrich}`.trim(), category, supplierId: supplierId || undefined, estimatedValue }, controller.signal)
        .then((result) => { setServerMatch(result); setMatchUnavailable(false); })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          setServerMatch(null); setMatchUnavailable(true);
        });
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [category, conError, conLoading, enrich, estimatedValue, supplierId, title]);

  // Which categories the catalogue can actually fulfil — admin config, falling
  // back to the canonical taxonomy so an empty store behaves identically.
  const eligibleCategories = useMemo(() => {
    const src = dbCategories.length > 0 ? dbCategories : DEFAULT_CATEGORY_TAXONOMY;
    return src.filter((c) => c.catalogueEligible).map((c) => c.id);
  }, [dbCategories]);

  // The enrichment sharpens the contract match, so it is part of the demand.
  const decision = useMemo(
    () =>
      decideIntakeRoute(
        { text: `${title} ${enrich}`.trim(), category, estimatedValue, supplierId, llmIntent },
        { catalogueItems, contracts, catalogueEligibleCategories: eligibleCategories },
        undefined,
        formatCurrency,
      ),
    [title, enrich, category, estimatedValue, supplierId, llmIntent,
     catalogueItems, contracts, eligibleCategories],
  );

  const supplierById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);

  const serverContractMatches = useMemo(() => {
    if (!serverMatch) return undefined;
    return serverMatch.candidates
      .map((candidate) => {
        const contract = contracts.find((item) => item.id === candidate.contractId);
        return contract ? { contract, score: candidate.score, reasons: candidate.reasons } : null;
      })
      .filter((match): match is { contract: Contract; score: number; reasons: string[] } => Boolean(match));
  }, [contracts, serverMatch]);
  const contractMatches = serverContractMatches ?? decision.contractMatches;

  // ── The buying channel, as far as it can be known here ───────────────────
  //
  // `computeDemandSignals` supplies the risk and materiality inputs rather than
  // this screen inventing them: it is the same capture-time read the service
  // description is generated against, and it marks itself preliminary. Two of
  // the ten live rules read those fields, so omitting them would silently
  // change the answer relative to the determination.
  const signals = useMemo(
    () => computeDemandSignals({
      category,
      value: estimatedValue,
      sow: { objective: `${title} ${enrich}`.trim() },
      contractCovered: contractMatches.length > 0,
    }),
    [category, estimatedValue, title, enrich, contractMatches.length],
  );

  const routing = useMemo(
    () => resolveDemandChannel(routingRules, {
      category,
      value: estimatedValue,
      supplierId,
      // The pre-check is where the contract question is settled, and it is the
      // one routing input step 1 could not have.
      contractId: contractMatches[0]?.contract.id,
      riskRating: signals.inherentRiskTier,
      material: signals.material,
    }),
    [routingRules, category, estimatedValue, supplierId, contractMatches, signals],
  );

  const timelineByCategory = useMemo(() => {
    const src = dbCategories.length > 0 ? dbCategories : DEFAULT_CATEGORY_TAXONOMY;
    return new Map(src.map((c) => [c.id, c.timelineDays]));
  }, [dbCategories]);

  /**
   * The channel for the route this screen has settled on.
   *
   * A catalogue order and a contract call-off ARE channels — stating them as
   * such is not a second derivation, it is naming the route the requester is
   * about to take. Only the new-demand path goes through the rules.
   */
  const channelFor = (route: 'catalogue' | 'contract' | 'new-demand') => {
    if (route === 'catalogue') {
      return {
        label: buyingChannelLabel('catalogue'),
        days: timelineByCategory.get('catalogue'),
        decidedBy: 'the catalogue match — pre-approved items are ordered directly',
      };
    }
    if (route === 'contract') {
      return {
        label: buyingChannelLabel('framework-call-off'),
        days: timelineByCategory.get(category),
        decidedBy: 'the covering contract — a call-off does not need a new sourcing exercise',
      };
    }
    return {
      label: buyingChannelLabel(routing.channel),
      days: timelineByCategory.get(category),
      decidedBy: routing.matchedRule
        ? `routing rule ${routing.matchedRule.id} “${routing.matchedRule.name}”`
        : 'the default fallback — no admin routing rule matched this demand',
    };
  };

  const catalogueMatches = decision.catalogueMatches.map((m) => m.item);
  const hasCatalogue = catalogueMatches.length > 0;
  const canCallOff = contractMatches.length > 0 && (!serverMatch || serverMatch.route === 'contract');
  const hasContract = canCallOff;

  // Open on the catalogue only when it is genuinely in play. A ruled-out
  // catalogue is stated once and stepped over, not rendered as an empty card
  // the user has to dismiss.
  const catalogueApplies = hasCatalogue || !decision.ruledOut.catalogue;
  const stage: Stage = forcedStage ?? (catalogueApplies ? 'catalogue' : 'contract');

  const goToContractStage = () => {
    if (enrich.trim() && onEnrich) onEnrich(enrich.trim());
    setForcedStage('contract');
  };

  // An unreachable source is not a reason to spin forever. With no catalogue and
  // no contract register loaded there is nothing true to say about either, so
  // say that and offer the one route that is still valid — rather than leaving
  // the requester on a spinner, or worse, implying "no match" when nothing was
  // actually checked.
  if (catError || conError) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Pre-check unavailable</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            The catalogue and contract register could not be reached, so neither could be
            checked. Nothing has been ruled in or out.
          </p>
        </div>
        <ProceedPanel lead="Continue without the pre-check?" onProceed={onProceedToFullRequest} />
      </div>
    );
  }

  if (catLoading || conLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <Loader2 className="size-8 animate-spin text-blue-500" />
        <p className="mt-4 text-sm font-medium">Checking the catalogue…</p>
      </div>
    );
  }

  // ── Stage 1 — Catalogue derivation ───────────────────────────────────────
  if (stage === 'catalogue') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Catalogue check</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            The fastest path is an existing catalogue item. Let&apos;s see if one fits before we go
            any further.
          </p>
          <p className="mt-2 text-xs text-gray-600">
            Checking: <span className="font-medium text-gray-900">{title}</span>
          </p>
        </div>

        {decision.llmOverruled && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {decision.llmOverruled}
          </p>
        )}

        {/* The consequence, stated before the choice rather than four steps
            after it. A catalogue match means a catalogue order; if none fits,
            the panel below the contract check shows where the demand goes. */}
        {(() => {
          const c = channelFor(hasCatalogue ? 'catalogue' : 'new-demand');
          return (
            <ChannelPanel
              channelLabel={c.label}
              timelineDays={c.days}
              decidedBy={c.decidedBy}
              note={hasCatalogue
                ? 'If none of these items fit, the channel changes — the contract check comes next.'
                : 'This is where the demand goes if no catalogue item or contract covers it.'}
            />
          );
        })()}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShoppingCart className="size-4 text-green-600" />
              Matching catalogue items
              <span className="text-[11px] font-normal text-gray-400">
                {hasCatalogue ? `${catalogueMatches.length} match${catalogueMatches.length === 1 ? '' : 'es'} found` : 'no match'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasCatalogue ? (
              <div className="space-y-2">
                {decision.catalogueMatches.map(({ item, matched }) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {item.description} &middot; {item.supplierName} &middot; {item.leadTime}
                      </p>
                      {/* Show WHICH words matched. A suggestion the user can
                          check is a suggestion they can reject. */}
                      {matched.length > 0 && (
                        <p className="mt-0.5 text-[11px] text-gray-400">
                          matched on {matched.map((w) => `“${w}”`).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="ml-3 text-sm font-semibold text-gray-900">
                      {formatCurrency(item.unitPrice)} / {item.unit}
                    </div>
                  </div>
                ))}
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white mt-3"
                  onClick={() => onChooseCatalogue(catalogueMatches)}
                >
                  <Check className="size-4" />
                  Order from catalogue ({catalogueMatches.length} match{catalogueMatches.length === 1 ? '' : 'es'})
                </Button>
                <p className="mt-2 text-center text-xs text-gray-400">
                  Not what you need?{' '}
                  <button type="button" className="font-medium text-blue-600 hover:underline" onClick={goToContractStage}>
                    Check for a covering contract
                  </button>
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                {decision.ruledOut.catalogue ?? 'No catalogue item matches your description so far.'}
              </p>
            )}
          </CardContent>
        </Card>

        {/* The enrichment prompt is shown whether or not a catalogue item
            matched. Hiding it behind `!hasCatalogue` meant a wrong match closed
            off the only route that carries detail into the contract check. */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-900">Tell us a bit more</p>
          <p className="mt-0.5 text-xs text-gray-500">
            Add the specifics that distinguish this from a generic need — it sharpens the contract match.{' '}
            {enrichGuidance(category)}.
          </p>
          <Textarea
            className="mt-3"
            rows={3}
            placeholder={enrichGuidance(category)}
            value={enrich}
            onChange={(e) => setEnrich(e.target.value)}
          />
          <Button className="mt-3" onClick={goToContractStage} disabled={!enrich.trim() && !hasCatalogue}>
            Check for a covering contract
            <ArrowRight className="size-4" />
          </Button>
        </div>

        <ProceedPanel
          lead={hasCatalogue ? 'None of these fit?' : 'Not a catalogue item?'}
          onProceed={onProceedToFullRequest}
        />
      </div>
    );
  }

  // ── Stage 2 — Contract derivation ────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Contract check</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Next we look for an active contract that can already cover this.
          </p>
          <p className="mt-2 text-xs text-gray-600">
            Checking: <span className="font-medium text-gray-900">{title}</span>
          </p>
        </div>
        {/* Reachable even when the catalogue was ruled out — the decision is
            visible and reversible, not imposed. */}
        <Button variant="ghost" size="sm" onClick={() => setForcedStage('catalogue')}>
          <ArrowLeft className="size-3.5" />
          {catalogueApplies ? 'Catalogue' : 'Browse the catalogue anyway'}
        </Button>
      </div>


      {!catalogueApplies && decision.ruledOut.catalogue && (
        <p className="flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
          <Info className="mt-px size-3.5 shrink-0 text-gray-400" />
          <span>Catalogue check skipped — {decision.ruledOut.catalogue}</span>
        </p>
      )}

      {decision.llmOverruled && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {decision.llmOverruled}
        </p>
      )}

      {serverMatch?.route === 'clarify' && serverMatch.questions.length > 0 && clarificationRound < 3 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">More information needed</CardTitle>
            <p className="text-xs text-gray-600">
              We found possible contract coverage, but need one detail to confirm the right one.
              Question {clarificationRound + 1} of 3.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm font-medium text-gray-900">{serverMatch.questions[0]}</p>
            <Textarea
              value={enrich}
              onChange={(event) => setEnrich(event.target.value)}
              placeholder={`Add a detail (${enrichGuidance(category)})`}
              aria-label="Contract matching clarification"
              rows={3}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-gray-500">You can answer “I don’t know” and continue to a full request.</p>
              <Button size="sm" onClick={() => { setClarificationRound((round) => round + 1); onEnrich?.(enrich.trim()); }}>
                Use this detail
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {matchUnavailable && (
        <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
          Preliminary match only — server confirmation will be required before a contract call-off can be submitted.
        </p>
      )}

      {serverMatch?.route === 'full-request' && (
        <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
          We could not confirm contract coverage from the information provided. Continue with a new request and we&apos;ll collect the full service details.
        </p>
      )}

      {(() => {
        const c = channelFor(hasContract ? 'contract' : 'new-demand');
        return (
          <ChannelPanel
            channelLabel={c.label}
            timelineDays={c.days}
            decidedBy={c.decidedBy}
            note={hasContract
              ? 'Calling off an existing contract. Proceeding to a full request instead changes the channel.'
              : undefined}
          />
        );
      })()}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="size-4 text-blue-600" />
            {serverMatch?.route === 'clarify' ? 'Possible contract matches' : 'Active contracts that can cover this'}
            <span className="text-[11px] font-normal text-gray-400">
              {contractMatches.length > 0 ? `${contractMatches.length} candidate${contractMatches.length === 1 ? '' : 's'}` : 'no match'}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contractMatches.length === 0 ? (
            <p className="text-sm text-gray-500">
              {decision.ruledOut.contract ?? 'No active contract appears to cover this request.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {contractMatches.map(({ contract, reasons, score }) => (
                <li
                  key={contract.id}
                  className="rounded-md border border-blue-100 bg-blue-50/40 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{contract.title}</p>
                      <p className="text-xs text-gray-500">
                        {contract.id} &middot; {contract.supplierName} &middot; {formatCurrency(contract.value)} &middot; {contract.utilisationPercentage}% utilised
                      </p>
                      <ul className="mt-1 pl-4 list-disc text-[11px] text-gray-500">
                        {reasons.map((r) => (<li key={r}>{r}</li>))}
                      </ul>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="text-[11px] text-gray-400">fit {(score * 100).toFixed(0)}%</span>
                      <Button
                        size="sm"
                        disabled={!canCallOff}
                        onClick={() => onChooseContract(contract, supplierById.get(contract.supplierId))}
                      >
                        <ArrowRight className="size-3.5" />
                        {canCallOff ? 'Call-off' : 'Confirm details first'}
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ProceedPanel
        lead={hasContract ? 'None of these fit?' : 'No catalogue item or contract covers this.'}
        onProceed={onProceedToFullRequest}
      />
    </div>
  );
}
