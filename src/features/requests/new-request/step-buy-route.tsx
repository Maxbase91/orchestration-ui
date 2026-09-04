// How you'll buy — one screen, one decision, three options in view.
//
// This was `step-pre-check.tsx`: two sequential stages, each with an intro
// paragraph, a channel panel, a results card annotated with the words that
// matched, contract IDs and utilisation percentages, an enrichment box with
// category-specific guidance, a two-sentence panel explaining what a full
// request entails, and up to five conditional banners on top. A requester who
// does not know procurement could not find the decision in it.
//
// Three things changed, and each is a judgement worth recording:
//
//  1. **The stages collapsed into one screen.** Catalogue-then-contract was a
//     funnel in the implementation, so it became a funnel in the UI. But the
//     requester is answering one question — how do I get this? — and the three
//     answers are comparable. Showing them together also removes the failure
//     the staging created: a wrong catalogue match hid the contract check
//     behind a large green button pointing the other way.
//  2. **The recommendation leads, in outcome language.** "Procurement-Led
//     Sourcing" is precise and means nothing to someone buying a laptop.
//     `buyingChannelPlain` says what will happen and roughly how long it takes.
//  3. **The evidence moved behind a disclosure.** Matched words, fit
//     percentages, contract utilisation and routing rule IDs are how a buyer
//     audits the decision, not how a requester makes one. They are still there,
//     under "Why this?", collapsed by default.
//
// The DECISION is untouched: `decideIntakeRoute` and `resolveDemandChannel` are
// the same functions, called the same way. This screen is a thinner presenter
// over the same answer.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ShoppingCart, FileText, ArrowRight, Check, Loader2, Route, ChevronDown, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useSourceData } from '@/lib/integrations';
import { useProcurementCategories } from '@/lib/db/hooks/use-procurement-categories';
import { DEFAULT_CATEGORY_TAXONOMY } from '@/data/category-taxonomy';
import { decideIntakeRoute, type IntakeRoute } from '@/lib/procurement/intake-routing';
import { useRoutingRules } from '@/lib/db/hooks/use-routing-rules';
import { buyingChannelPlain, buyingChannelLabel } from '@/lib/routing/evaluate-routing-rules';
import { resolveDemandChannel } from '@/lib/routing/demand-channel';
import { computeDemandSignals } from '@/lib/procurement/demand-signals';
import { requestContractMatch } from '@/lib/procurement/contract-match-api';
import type { CatalogueItem } from '@/data/catalogue-items';
import type { Contract, ContractMatchResponse, Supplier } from '@/data/types';

export type PreCheckOutcome = 'catalogue' | 'contract' | 'full-request';

interface StepBuyRouteProps {
  title: string;
  /** Detail already added to sharpen the match, kept out of the title. */
  demandDetail?: string;
  category: string;
  estimatedValue: number;
  supplierId: string;
  /** api/ai.ts `intent` from the describe step — authoritative when honourable. */
  llmIntent?: string;
  onChooseCatalogue: (items: CatalogueItem[]) => void;
  onChooseContract: (contract: Contract, supplier: Supplier | undefined) => void;
  onProceedToFullRequest: () => void;
  /** Carry enrichment text forward so the full SD / second contract check benefit. */
  onEnrich?: (text: string) => void;
}

// Category-specific guidance so "Add a bit more detail" asks for the detail that
// actually distinguishes one contract from another — not a generic prompt.
const ENRICH_GUIDANCE: Record<string, string> = {
  consulting: 'the focus area, expected duration, and team size',
  services: 'the service type, sites covered, duration, and service levels',
  software: 'the product, number of users, hosting, and contract term',
  'contingent-labour': 'the role, seniority, number of people, and engagement length',
  goods: 'the items, quantity, key specifications, and delivery location',
  'contract-renewal': 'the existing supplier, the term to renew, and any scope change',
};
const enrichGuidance = (category: string) =>
  ENRICH_GUIDANCE[category] ?? 'the scope, region, duration, and approximate size';

/** One route, as a choice the requester can weigh against the others. */
function RouteOption({
  recommended, headline, detail, timelineDays, action, actionLabel, disabledReason, icon, children,
}: {
  recommended: boolean;
  headline: string;
  detail: string;
  timelineDays?: number;
  /** Omitted when the rows below ARE the choice. */
  action?: () => void;
  actionLabel?: string;
  /** Why this route is not available, in plain words. Shown, never hidden. */
  disabledReason?: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        recommended ? 'border-blue-200 bg-blue-50/40' : 'border-gray-200 bg-white',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="text-sm font-semibold text-gray-900">{headline}</p>
            {recommended && (
              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                Recommended
              </span>
            )}
            {timelineDays !== undefined && (
              <span className="text-xs text-gray-500">about {timelineDays} days</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-600">{disabledReason ?? detail}</p>
          {children}
        </div>
        {action && actionLabel && (
          <Button
            size="sm"
            variant={recommended ? 'default' : 'outline'}
            className="shrink-0"
            onClick={action}
          >
            {actionLabel}
            <ArrowRight className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function StepBuyRoute({
  title, demandDetail = '', category, estimatedValue, supplierId, llmIntent,
  onChooseCatalogue, onChooseContract, onProceedToFullRequest, onEnrich,
}: StepBuyRouteProps) {
  // Reads go through the standardised source-connector layer (own store today,
  // live source later) rather than directly to the data layer.
  const { data: catalogueItems = [], isLoading: catLoading, isError: catError } =
    useSourceData<CatalogueItem>('catalogue-item');
  const { data: contracts = [], isLoading: conLoading, isError: conError } =
    useSourceData<Contract>('contract');
  const { data: suppliers = [] } = useSourceData<Supplier>('supplier');
  const { data: dbCategories = [] } = useProcurementCategories();
  const { data: routingRules = [] } = useRoutingRules();

  // `enrich` is a DRAFT. Once it is used it is lifted into the demand and
  // cleared here — keeping both meant the demand text became
  // "buy consulting — IT strategy work IT strategy work", because the decision
  // reads `title + enrich` and the lift had already appended it to the title.
  const [enrich, setEnrich] = useState('');
  const [showEnrich, setShowEnrich] = useState(false);
  const enrichRef = useRef<HTMLTextAreaElement>(null);

  /**
   * "Add detail" has to *do* something every time it is pressed.
   *
   * It only set `showEnrich`, and the box is already on screen whenever nothing
   * matched — which is exactly when both Add-detail buttons appear. So in the
   * common case the button changed a flag that was already satisfied and
   * nothing moved: to the requester it was simply dead.
   *
   * Revealing is not enough on its own either; the box can be below the fold.
   * Scroll to it and put the cursor in it, so the press always lands somewhere
   * visible.
   */
  const promptForDetail = useCallback(() => {
    setShowEnrich(true);
    // After the box has had a chance to mount, if it was not already there.
    requestAnimationFrame(() => {
      enrichRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      enrichRef.current?.focus();
    });
  }, []);
  /** Detail the requester has actually supplied on this screen. */
  const [detailAdded, setDetailAdded] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [serverMatch, setServerMatch] = useState<ContractMatchResponse | null>(null);
  const [matchUnavailable, setMatchUnavailable] = useState(false);

  // One demand text: the title, the detail already lifted out of it, and the
  // draft currently being typed. `enrich` is cleared once lifted, so nothing is
  // counted twice.
  const demandText = useMemo(
    () => [title, demandDetail, enrich].map((part) => part.trim()).filter(Boolean).join(' '),
    [title, demandDetail, enrich],
  );

  // Debounce the server match while the requester types clarification detail.
  // The local matcher remains available as a responsive preview if the API is down.
  useEffect(() => {
    if (!title.trim() || conLoading || conError) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void requestContractMatch(
        { text: demandText, category, supplierId: supplierId || undefined, estimatedValue },
        controller.signal,
      )
        .then((result) => { setServerMatch(result); setMatchUnavailable(false); })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          setServerMatch(null); setMatchUnavailable(true);
        });
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [category, conError, conLoading, demandText, estimatedValue, supplierId, title]);

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
        { text: demandText, category, estimatedValue, supplierId, llmIntent },
        { catalogueItems, contracts, catalogueEligibleCategories: eligibleCategories },
        undefined,
        formatCurrency,
      ),
    [demandText, category, estimatedValue, supplierId, llmIntent,
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

  // `computeDemandSignals` supplies the risk and materiality inputs rather than
  // this screen inventing them: it is the same capture-time read the service
  // description is generated against. Two of the ten live rules read those
  // fields, so omitting them would silently change the answer relative to the
  // determination.
  const signals = useMemo(
    () => computeDemandSignals({
      category,
      value: estimatedValue,
      sow: { objective: demandText },
      contractCovered: contractMatches.length > 0,
    }),
    [category, estimatedValue, demandText, contractMatches.length],
  );

  const routing = useMemo(
    () => resolveDemandChannel(routingRules, {
      category,
      value: estimatedValue,
      supplierId,
      // This screen settles the contract question, and it is the one routing
      // input the describe step could not have.
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

  const catalogueMatches = decision.catalogueMatches.map((m) => m.item);
  const hasCatalogue = catalogueMatches.length > 0;
  const canCallOff = contractMatches.length > 0 && (!serverMatch || serverMatch.route === 'contract');
  const recommended: IntakeRoute = decision.route;

  /**
   * The server matcher's own request for a detail, when it has one.
   *
   * ADR-0004: the matcher asks up to three clarifying questions rather than
   * guessing between contracts. That question is the prompt the enrichment box
   * should be asking — a generic "add a bit more detail" wastes the fact that
   * the matcher knows exactly what it is missing.
   */
  const clarifyingQuestion =
    serverMatch?.route === 'clarify' ? serverMatch.questions[0] : undefined;

  /**
   * Are the contract candidates worth showing yet?
   *
   * A list of four contracts with disabled "Confirm details first" buttons is
   * not a choice, it is furniture: the requester cannot act on any of them and
   * has not been told what would make them actionable. So the list appears only
   * once it means something — the matcher confirmed coverage, or the requester
   * supplied the detail it asked for. Until then the option states that
   * coverage might exist and asks for the one thing that would settle it.
   */
  const showContractCandidates =
    contractMatches.length > 0 && (canCallOff || detailAdded || demandDetail.trim().length > 0);

  const useEnrichment = () => {
    const text = enrich.trim();
    if (!text) return;
    onEnrich?.(text);
    // Lifted into the demand — clear the draft so it is not counted twice.
    setEnrich('');
    setDetailAdded(true);
    setShowEnrich(false);
  };

  // An unreachable source is not a reason to spin forever. With no catalogue and
  // no contract register loaded there is nothing true to say about either, so
  // say that and offer the one route that is still valid — rather than leaving
  // the requester on a spinner, or worse, implying "no match" when nothing was
  // actually checked.
  if (catError || conError) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">We could not check what already exists</h2>
          <p className="mt-0.5 text-sm text-gray-600">
            The catalogue and contract register could not be reached, so neither was checked.
            Nothing has been ruled in or out.
          </p>
        </div>
        <RouteOption
          recommended
          icon={<PenLine className="size-4 text-[#2D5F8A]" />}
          headline="Raise a full request"
          detail="We will collect a service description, identify suppliers and assess risk before routing."
          action={onProceedToFullRequest}
          actionLabel="Continue"
        />
      </div>
    );
  }

  if (catLoading || conLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <Loader2 className="size-8 animate-spin text-blue-500" />
        <p className="mt-4 text-sm font-medium">Checking what already exists…</p>
      </div>
    );
  }

  const catalogueChannel = buyingChannelPlain('catalogue');
  const contractChannel = buyingChannelPlain('framework-call-off');

  // The third option is "this is new demand", and its headline says exactly
  // that. The resolved channel describes what happens *after* — but it can come
  // back `catalogue` or `framework-call-off`, which are the other two options
  // on this screen, and borrowing their copy here labelled the full-request
  // escape "Order it from the catalogue". Only a channel that genuinely means
  // a new request is allowed to speak for it.
  const resolved = buyingChannelPlain(routing.channel);
  const channelDescribesNewDemand =
    routing.channel !== 'catalogue' && routing.channel !== 'framework-call-off';
  const fullRequestDetail = channelDescribesNewDemand
    // Lower-cased at the join: the detail is written to open a sentence, and
    // "…sourcing exercise — A buyer takes this on" reads as two half-sentences.
    ? `${resolved.headline} — ${resolved.detail.charAt(0).toLowerCase()}${resolved.detail.slice(1)}`
    : 'We collect a service description, identify suppliers and assess risk before routing.';

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900">How you&apos;ll buy this</h2>
        <p className="mt-0.5 text-sm text-gray-600">
          We looked for a catalogue item and an existing contract first, because both are faster.
          Pick the one that fits — you can change your mind here.
        </p>
      </div>

      {/* Every option, every time, ordered with the recommendation first. The
          two-stage version hid whichever route it had not reached yet. */}
      <div className="space-y-2.5">
        <RouteOption
          recommended={recommended === 'catalogue'}
          icon={<ShoppingCart className="size-4 text-green-600" />}
          headline={catalogueChannel.headline}
          detail={catalogueChannel.detail}
          timelineDays={hasCatalogue ? timelineByCategory.get('catalogue') : undefined}
          disabledReason={hasCatalogue ? undefined : decision.ruledOut.catalogue}
          action={hasCatalogue ? undefined : promptForDetail}
          actionLabel={hasCatalogue ? undefined : 'Add detail'}
        >
          {/* Each match is its own choice. These were plain list items under a
              single button that ordered `catalogueMatches` wholesale, so a
              requester shown three items could not pick the second. */}
          {hasCatalogue && (
            <ul className="mt-2 space-y-1">
              {decision.catalogueMatches.slice(0, 3).map(({ item }) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onChooseCatalogue([item])}
                    className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-white"
                  >
                    <span className="min-w-0 truncate text-gray-700">
                      <span className="font-medium text-gray-900">{item.name}</span>
                      {' · '}{formatCurrency(item.unitPrice)} / {item.unit}
                      {' · '}{item.leadTime}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 font-medium text-[#2D5F8A]">
                      Order this<ArrowRight className="size-3" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </RouteOption>

        <RouteOption
          recommended={recommended === 'contract'}
          icon={<FileText className="size-4 text-blue-600" />}
          headline={contractChannel.headline}
          detail={contractChannel.detail}
          timelineDays={canCallOff ? timelineByCategory.get(category) : undefined}
          disabledReason={
            contractMatches.length > 0
              ? (canCallOff
                  ? undefined
                  : 'We found possible coverage. One detail settles which contract it is.')
              : decision.ruledOut.contract
          }
          action={canCallOff ? undefined : promptForDetail}
          actionLabel={canCallOff ? undefined : 'Add detail'}
        >
          {/* Each candidate is its own choice. They were plain list items under
              one button that called off `contractMatches[0]` whatever was
              shown — so a requester offered four contracts could not pick the
              second, and when the server had not confirmed coverage the whole
              list sat there inert with nothing saying why. */}
          {showContractCandidates && (
            <ul className="mt-2 space-y-1">
              {contractMatches.slice(0, 3).map(({ contract }) => (
                <li key={contract.id}>
                  {canCallOff ? (
                    <button
                      type="button"
                      onClick={() => onChooseContract(contract, supplierById.get(contract.supplierId))}
                      className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-white"
                    >
                      <span className="min-w-0 truncate text-gray-700">
                        <span className="font-medium text-gray-900">{contract.title}</span>
                        {' · '}{contract.supplierName}
                      </span>
                      <span className="flex shrink-0 items-center gap-1 font-medium text-[#2D5F8A]">
                        Call it off<ArrowRight className="size-3" />
                      </span>
                    </button>
                  ) : (
                    // Listed but not yet selectable, and it says so rather than
                    // looking broken.
                    <div className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-xs">
                      <span className="min-w-0 truncate text-gray-500">
                        <span className="font-medium text-gray-700">{contract.title}</span>
                        {' · '}{contract.supplierName}
                      </span>
                      <span className="shrink-0 text-gray-400">awaiting confirmation</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </RouteOption>

        <RouteOption
          recommended={recommended === 'new-demand'}
          icon={<PenLine className="size-4 text-[#2D5F8A]" />}
          headline="Raise a full request"
          detail={fullRequestDetail}
          timelineDays={timelineByCategory.get(category)}
          action={onProceedToFullRequest}
          actionLabel="Start"
        />
      </div>

      {/* One box, shown when the decision could still be sharpened — not two
          enrichment blocks, one per stage, each with its own guidance string. */}
      {(showEnrich || clarifyingQuestion || (!hasCatalogue && contractMatches.length === 0)) && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-900">
            {clarifyingQuestion ? 'One detail would settle this' : 'Add a bit more detail'}
          </p>
          {/* The matcher knows what it is missing (ADR-0004), so it asks. A
              generic prompt threw that away and made the requester guess. */}
          <p className="mt-0.5 text-xs text-gray-500">
            {clarifyingQuestion ?? `The more specific you are, the better we can match — try ${enrichGuidance(category)}.`}
          </p>
          <Textarea
            ref={enrichRef}
            className="mt-3"
            rows={3}
            placeholder={enrichGuidance(category)}
            value={enrich}
            onChange={(e) => setEnrich(e.target.value)}
            aria-label={clarifyingQuestion ?? 'Add more detail about what you need'}
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[11px] text-gray-500">
              You can skip this and raise a full request instead.
            </p>
            <Button size="sm" disabled={!enrich.trim()} onClick={useEnrichment}>
              <Check className="size-3.5" />
              Use this detail
            </Button>
          </div>
        </div>
      )}

      {/* Clicking "Use this detail" used to do nothing visible: the text was
          appended to the demand behind the screen while the box kept its
          contents, so it looked ignored — and the decision then read the detail
          twice. It is now confirmed, and the re-matched result is what changes
          above. */}
      {detailAdded && (
        <p className="flex items-center gap-1.5 text-xs text-green-700">
          <Check className="size-3.5" />
          Detail added — the options above have been re-checked against it.
        </p>
      )}

      {/* Server confirmation is still required before a call-off can be
          submitted; say so once, quietly, rather than as a banner. */}
      {matchUnavailable && contractMatches.length > 0 && (
        <p className="text-xs text-gray-500">
          Contract coverage is a preliminary match — it is confirmed on the server before submission.
        </p>
      )}

      {/* ── Why this? ──
          The audit trail: matched words, fit, utilisation, the routing rule that
          decided it. This is how a buyer checks the decision, not how a
          requester makes one, so it is closed by default and expert-only. */}
      {(
        <div>
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
            onClick={() => setShowEvidence((open) => !open)}
            aria-expanded={showEvidence}
          >
            <ChevronDown className={cn('size-3.5 transition-transform', showEvidence && 'rotate-180')} />
            Why this?
          </button>
          {showEvidence && (
            <div className="mt-2 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
              <p className="flex items-start gap-2">
                <Route className="mt-0.5 size-3.5 shrink-0 text-gray-400" />
                <span>
                  Buying channel <span className="font-medium text-gray-900">{buyingChannelLabel(routing.channel)}</span>
                  {' — '}
                  {routing.matchedRule
                    ? `routing rule ${routing.matchedRule.id} “${routing.matchedRule.name}”`
                    : 'the default fallback; no admin routing rule matched this demand'}.
                </span>
              </p>
              {decision.llmOverruled && <p className="text-amber-700">{decision.llmOverruled}</p>}
              {decision.reasons.map((reason) => (<p key={reason}>{reason}</p>))}
              {decision.catalogueMatches.map(({ item, matched, score }) => (
                <p key={item.id}>
                  {item.name} — score {score.toFixed(1)}
                  {matched.length > 0 && <> · matched on {matched.map((w) => `“${w}”`).join(', ')}</>}
                </p>
              ))}
              {contractMatches.map(({ contract, score, reasons }) => (
                <p key={contract.id}>
                  {contract.id} {contract.title} — fit {(score * 100).toFixed(0)}%
                  {' · '}{contract.utilisationPercentage}% utilised
                  {reasons.length > 0 && <> · {reasons.join('; ')}</>}
                </p>
              ))}
              {serverMatch?.route === 'clarify' && serverMatch.questions.length > 0 && (
                <p>Server asks: {serverMatch.questions[0]}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
