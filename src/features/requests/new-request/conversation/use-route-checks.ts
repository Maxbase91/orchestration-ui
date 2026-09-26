// How it can be bought: the catalogue and the contracts checked first, then the
// channel a new request would take — the answer the conversation page gives
// after "Is that right?".
//
// Moved out of step-buy-route.tsx (the retired How you'll buy step) unchanged in
// what it decides: `decideIntakeRoute` for the catalogue and the local contract
// preview, the server matcher for coverage (ADR-0004 — it asks for the one
// detail that settles which contract, rather than guessing), and
// `resolveDemandChannel` with the full routing inputs for everything else. What
// is new is `settled`: a conversation turn has to wait for the server's answer
// before it can say "a contract covers this" — the screen could simply update.
import { useEffect, useMemo, useState } from 'react';
import { useSourceData } from '@/lib/integrations';
import { useProcurementCategories } from '@/lib/db/hooks/use-procurement-categories';
import { DEFAULT_CATEGORY_TAXONOMY } from '@/data/category-taxonomy';
import { decideIntakeRoute } from '@/lib/procurement/intake-routing';
import { useRoutingRules } from '@/lib/db/hooks/use-routing-rules';
import { resolveDemandChannel } from '@/lib/routing/demand-channel';
import { usePolicyConfig } from '@/lib/procurement/use-policy-config';
import { computeDemandSignals } from '@/lib/procurement/demand-signals';
import { usePreferredSupplierIds } from '@/lib/db/hooks/use-category-preferred-suppliers';
import { requestContractMatch } from '@/lib/procurement/contract-match-api';
import { formatCurrency } from '@/lib/format';
import type { CatalogueItem } from '@/data/catalogue-items';
import type { Contract, ContractMatchResponse, Supplier } from '@/data/types';

export interface RouteCheckInput {
  /** The demand's title (the words, after "Is that right?"). Empty: nothing is checked. */
  title: string;
  /** Detail added since — the answer to "one detail decides it", kept out of the title. */
  demandDetail: string;
  category: string;
  estimatedValue: number;
  supplierId: string;
  llmIntent?: string;
  isUrgent?: boolean;
  commodityCode?: string;
}

/**
 * Category-specific guidance for the detail that distinguishes one contract
 * from another, when the matcher has no question of its own.
 */
const ENRICH_GUIDANCE: Record<string, string> = {
  consulting: 'the focus area, expected duration, and team size',
  services: 'the service type, sites covered, duration, and service levels',
  software: 'the product, number of users, hosting, and contract term',
  'contingent-labour': 'the role, seniority, number of people, and engagement length',
  goods: 'the items, quantity, key specifications, and delivery location',
};
export const enrichGuidance = (category: string) =>
  ENRICH_GUIDANCE[category] ?? 'the scope, region, duration, and approximate size';

export function useRouteChecks(input: RouteCheckInput | null) {
  // Reads go through the standardised source-connector layer (own store today,
  // live source later) rather than directly to the data layer.
  const { data: catalogueItems = [], isLoading: catLoading, isError: catError } = useSourceData<CatalogueItem>('catalogue-item');
  const { data: contracts = [], isLoading: conLoading, isError: conError } = useSourceData<Contract>('contract');
  const { data: suppliers = [] } = useSourceData<Supplier>('supplier');
  const { data: dbCategories = [] } = useProcurementCategories();
  const { data: routingRules = [] } = useRoutingRules();
  const policyConfig = usePolicyConfig();

  const title = input?.title ?? '';
  const category = input?.category ?? '';
  const estimatedValue = input?.estimatedValue ?? 0;
  const supplierId = input?.supplierId ?? '';
  const demandText = useMemo(
    () => [input?.title ?? '', input?.demandDetail ?? ''].map((part) => part.trim()).filter(Boolean).join(' '),
    [input?.title, input?.demandDetail],
  );

  // The server matcher, asked once per demand text. `matchFor` records which
  // text the answer belongs to, so a stale answer never settles a new question.
  const [serverMatch, setServerMatch] = useState<ContractMatchResponse | null>(null);
  const [matchFor, setMatchFor] = useState<string | null>(null);
  const [matchUnavailable, setMatchUnavailable] = useState(false);
  useEffect(() => {
    if (!title.trim() || conLoading || conError) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void requestContractMatch(
        { text: demandText, category, supplierId: supplierId || undefined, estimatedValue },
        controller.signal,
      )
        .then((result) => { setServerMatch(result); setMatchUnavailable(false); setMatchFor(demandText); })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          // The local preview stands in; the governed checkout confirms coverage
          // on the server before any call-off is placed.
          setServerMatch(null); setMatchUnavailable(true); setMatchFor(demandText);
        });
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [category, conError, conLoading, demandText, estimatedValue, supplierId, title]);

  // Which categories the catalogue can fulfil — admin config, falling back to
  // the canonical taxonomy so an empty store behaves identically.
  const eligibleCategories = useMemo(() => {
    const src = dbCategories.length > 0 ? dbCategories : DEFAULT_CATEGORY_TAXONOMY;
    return src.filter((c) => c.catalogueEligible).map((c) => c.id);
  }, [dbCategories]);

  const decision = useMemo(
    () => decideIntakeRoute(
      { text: demandText, category, estimatedValue, supplierId, llmIntent: input?.llmIntent },
      { catalogueItems, contracts, catalogueEligibleCategories: eligibleCategories },
      undefined,
      formatCurrency,
    ),
    [demandText, category, estimatedValue, supplierId, input?.llmIntent, catalogueItems, contracts, eligibleCategories],
  );

  const supplierById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);
  const contractMatches = useMemo(() => {
    if (!serverMatch) return decision.contractMatches;
    return serverMatch.candidates
      .map((candidate) => {
        const contract = contracts.find((item) => item.id === candidate.contractId);
        return contract ? { contract, score: candidate.score, reasons: candidate.reasons } : null;
      })
      .filter((match): match is { contract: Contract; score: number; reasons: string[] } => Boolean(match));
  }, [contracts, serverMatch, decision.contractMatches]);

  // The risk and materiality routing inputs come from the same capture-time
  // read the service description is generated against, not invented here.
  const preferredSupplierIds = usePreferredSupplierIds(category);
  const signals = useMemo(
    () => computeDemandSignals({
      category, value: estimatedValue, sow: { objective: demandText },
      contractCovered: contractMatches.length > 0, preferredSupplierIds,
    }),
    [category, estimatedValue, demandText, contractMatches.length, preferredSupplierIds],
  );
  const routing = useMemo(
    () => resolveDemandChannel(routingRules, {
      category, value: estimatedValue, supplierId,
      contractId: contractMatches[0]?.contract.id,
      riskRating: signals.inherentRiskTier,
      material: signals.material,
      isUrgent: input?.isUrgent,
      commodityCode: input?.commodityCode,
      supplierRiskRating: supplierId ? supplierById.get(supplierId)?.riskRating : undefined,
    }, policyConfig),
    [routingRules, category, estimatedValue, supplierId, contractMatches, signals, input?.isUrgent, input?.commodityCode, policyConfig, supplierById],
  );

  const detailAdded = Boolean(input?.demandDetail?.trim());
  /**
   * Can the requester call off against one of these contracts? The server
   * confirmed coverage, or the requester supplied the detail it asked for — the
   * assertion is checked again on submit, where the governed checkout refuses a
   * call-off whose scope does not confidently cover the demand.
   */
  const canCallOff = contractMatches.length > 0
    && (!serverMatch || serverMatch.route === 'contract' || detailAdded);
  /** The matcher's own request for a detail, when it has one (ADR-0004). */
  const clarifyingQuestion = serverMatch?.route === 'clarify' ? serverMatch.questions[0] : undefined;

  return {
    /** The sources could not be read, so nothing was ruled in or out. */
    unavailable: catError || conError,
    loading: catLoading || conLoading,
    /** The server has answered (or failed) for exactly this demand text. */
    settled: !catLoading && !conLoading && (catError || conError || matchFor === demandText),
    decision,
    catalogueItems: decision.catalogueMatches.map((m) => m.item),
    contractMatches,
    canCallOff,
    clarifyingQuestion,
    matchUnavailable,
    routing,
    supplierById,
  };
}
