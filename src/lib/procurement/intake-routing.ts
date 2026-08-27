// Intake routing — is this demand a catalogue order, a call-off against an
// existing contract, or genuinely new?
//
// The staged funnel (INT-10) always asked that question, but the answer was an
// emergent property of three `useMemo`s inside step-pre-check.tsx: untestable,
// and with no place to say *why* a route was chosen. This module is that answer,
// made explicit and pure, so the screen becomes a presenter and the decision can
// be benchmarked like the classifier is (CLS-G1).
//
// ── Why the catalogue scoring changed ───────────────────────────────────────
// The previous matcher summed token hits with no divisor. That was itself a
// deliberate fix: an earlier version divided by the query length, which halved
// single-word hits below the threshold and diluted them further with every extra
// word, so "a few laptops for a new starter" matched nothing. Both halves of
// that history matter, because the raw sum over-corrected:
//
//     "I want to buy business consulting"  →  tokens [buy, business, consulting]
//     Business Cards 500   score 1.0   ← "business" hit the NAME
//     ThinkPad T14 Gen 5   score 0.5   ← "business laptop" in the DESCRIPTION
//
// One incidental adjective carried both matches. "consulting" — the only word
// that says what is being bought — contributed nothing *and cost nothing*, and
// the funnel offered a consulting demand a box of business cards.
//
// So: neither a raw sum nor a length-normalised one. A match must (a) come from
// a category the catalogue actually serves, and (b) hit a word that NAMES what
// is being bought, not merely one that describes it. Verbose asks still match,
// because circumstantial detail ("for a new starter") is not counted against a
// match — measuring coverage as a fraction of the query repeats the very
// mistake length-normalisation made.
//
// Config note: the thresholds live in `policy-config.ts` rather than a table.
// That is safe *here* — routing runs in the wizard, client-side, and no
// serverless route does catalogue matching. Anything a route needs to read must
// go in Postgres instead (see `service-description-templates`).

import type { CatalogueItem } from '@/data/catalogue-items';
import type { Contract } from '@/data/types';
import { getActivePolicyConfig, type PolicyConfig } from './policy-config';

export type IntakeRoute = 'catalogue' | 'contract' | 'new-demand';

/** Which layer chose the route — an operator needs to know, and so does the eval. */
export type RouteSource = 'llm' | 'rules';

export interface ScoredItem {
  item: CatalogueItem;
  score: number;
  matched: string[];
}

export interface ScoredContract {
  contract: Contract;
  score: number;
  reasons: string[];
}

export interface RouteDecision {
  route: IntakeRoute;
  decidedBy: RouteSource;
  confidence: 'high' | 'medium' | 'low';
  /** Why this route. */
  reasons: string[];
  /**
   * Why *not* the others. The honest half of the decision: a screen that can
   * say "catalogue ruled out — consulting isn't fulfilled from the catalogue"
   * is guidance; one that silently shows nothing is a shrug.
   */
  ruledOut: Partial<Record<IntakeRoute, string>>;
  catalogueMatches: ScoredItem[];
  contractMatches: ScoredContract[];
  /** True when the LLM's intent was overruled because it could not be honoured. */
  llmOverruled?: string;
}

export interface IntakeDemand {
  text: string;
  category: string;
  estimatedValue: number;
  supplierId: string;
  /** `intent` from api/ai.ts, when AI-001 is active and the call succeeded. */
  llmIntent?: string;
}

export interface RoutingData {
  catalogueItems: CatalogueItem[];
  contracts: Contract[];
  /** Category ids the catalogue can fulfil (procurement_categories.catalogue_eligible). */
  catalogueEligibleCategories: string[];
}

// ── Tokenising ──────────────────────────────────────────────────────────────

// Intent verbs describe the *act* of buying, never the thing bought. Leaving
// "buy" in the token stream let it match item text by coincidence.
const STOP_WORDS = new Set([
  'i', 'a', 'an', 'the', 'of', 'for', 'to', 'we', 'us', 'our', 'my',
  'need', 'want', 'would', 'like', 'please', 'can', 'new', 'some',
  'buy', 'buying', 'purchase', 'purchasing', 'procure', 'order', 'get',
  'looking', 'require', 'requires', 'and', 'with', 'from', 'about',
]);

/**
 * Words that qualify a thing without naming it.
 *
 * A match resting only on these is not a match: "business", "premium" and
 * "professional" appear across unrelated catalogues, so they identify nothing.
 * They still *contribute* to a score once a real term has landed — they just
 * cannot carry a route alone. This is the specific guard for the reported bug.
 */
const MODIFIER_WORDS = new Set([
  'business', 'premium', 'professional', 'standard', 'basic', 'advanced',
  'small', 'large', 'high', 'low', 'good', 'best', 'quality', 'general',
  'corporate', 'company', 'team', 'office', 'annual', 'monthly', 'daily',
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9-]/g, ''))
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/** Tokens that name something, as opposed to describing it. */
export function contentTokens(tokens: string[]): string[] {
  return tokens.filter((t) => !MODIFIER_WORDS.has(t));
}

function tokenMatches(haystack: string, token: string): boolean {
  if (haystack.includes(token)) return true;
  // plural → singular fallback so "laptops" matches "laptop" in the seed
  if (token.endsWith('s') && token.length > 3 && haystack.includes(token.slice(0, -1))) return true;
  return false;
}

// ── Catalogue ───────────────────────────────────────────────────────────────

export interface CatalogueMatchResult {
  score: number;
  matched: string[];
  /** Matched tokens that actually name something. */
  matchedContent: string[];
}

/**
 * Score one item against the demand's tokens.
 *
 * Name hits outrank description hits, as before — a plain product word
 * ("laptops") must still surface an item named by model ("ThinkPad T14 Gen 5",
 * described as a "business laptop").
 */
export function scoreCatalogueItem(item: CatalogueItem, tokens: string[]): CatalogueMatchResult {
  const name = item.name.toLowerCase();
  const haystack = `${item.description} ${item.catalogueName}`.toLowerCase();
  let score = 0;
  const matched: string[] = [];

  for (const t of tokens) {
    if (tokenMatches(name, t)) {
      score += 1.0;
      matched.push(t);
    } else if (tokenMatches(haystack, t)) {
      score += 0.5;
      matched.push(t);
    }
  }
  return { score, matched, matchedContent: contentTokens(matched) };
}

/**
 * The catalogue candidates for a demand, strongest first.
 *
 * Three gates, in the order that costs least to evaluate:
 *   1. the category must be one the catalogue serves;
 *   2. the match must hit a naming word, not only modifiers;
 *   3. it must clear the score floor.
 */
export function matchCatalogue(
  demand: Pick<IntakeDemand, 'text' | 'category'>,
  items: CatalogueItem[],
  eligibleCategories: string[],
  config: PolicyConfig = getActivePolicyConfig(),
): { matches: ScoredItem[]; ruledOut?: string } {
  const tokens = tokenize(demand.text);
  const content = contentTokens(tokens);

  if (!demand.text.trim()) {
    return { matches: [], ruledOut: 'Nothing captured yet to match against.' };
  }

  // Gate 1 — category. An unknown or unmapped category is NOT eligible: a
  // missed catalogue suggestion costs a click, a false one is this whole bug.
  if (!eligibleCategories.includes(demand.category)) {
    return {
      matches: [],
      ruledOut: demand.category
        ? `${demand.category} demand isn't fulfilled from the catalogue.`
        : 'The category is not yet known, so the catalogue cannot be checked.',
    };
  }

  if (content.length === 0) {
    return {
      matches: [],
      ruledOut: 'The description is all general words — nothing specific to match on yet.',
    };
  }

  const scored = items
    .map((item) => ({ item, ...scoreCatalogueItem(item, tokens) }))
    // Gate 2 — the decisive one. A match must hit a word that NAMES something.
    // Deliberately not a fraction of the query: "a few laptops for a new
    // starter" names one thing among five words, and scoring coverage as a
    // ratio rejects it — the same over-correction that length-normalisation
    // made, in a different shape. What matters is that the thing being bought
    // was matched, not how much circumstantial detail came with it.
    .filter((r) => r.matchedContent.length >= config.catalogueMinContentMatches)
    // Gate 3 — score floor.
    .filter((r) => r.score >= config.catalogueMatchThreshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  if (scored.length === 0) {
    return { matches: [], ruledOut: 'No catalogue item covers what was described.' };
  }
  return {
    matches: scored.map((r) => ({ item: r.item, score: r.score, matched: r.matched })),
  };
}

// ── Contracts ───────────────────────────────────────────────────────────────

/**
 * Moved verbatim from step-pre-check.tsx — the contract matcher was never
 * implicated in the mis-routing, because it already requires a primary signal
 * (supplier, category, or >=2 keyword hits). Moving it here is what makes it
 * testable; the scoring is unchanged.
 */
export function scoreContract(
  contract: Contract,
  ctx: { tokens: string[]; category: string; estimatedValue: number; supplierId: string },
  formatValue: (n: number) => string,
): { score: number; reasons: string[] } | null {
  if (contract.status !== 'active' && contract.status !== 'expiring') return null;
  let score = 0;
  const reasons: string[] = [];
  let hasPrimarySignal = false;

  if (ctx.supplierId && contract.supplierId === ctx.supplierId) {
    score += 0.5;
    hasPrimarySignal = true;
    reasons.push(`matches selected supplier ${contract.supplierName}`);
  }

  const catLower = contract.category.toLowerCase();
  if (catLower.includes(ctx.category) && ctx.category) {
    score += 0.3;
    hasPrimarySignal = true;
    reasons.push(`contract category is ${contract.category}`);
  }

  // Always score keywords, not only when the category misses: otherwise every
  // contract in a matching category ties on the +0.3 alone and the enrichment
  // the user adds changes nothing.
  const haystack = `${contract.title} ${contract.category}`.toLowerCase();
  let kwHits = 0;
  for (const t of ctx.tokens) {
    if (haystack.includes(t)) {
      kwHits += 1;
      if (!reasons.some((r) => r.includes(t))) reasons.push(`matches "${t}"`);
    }
  }
  score += kwHits * 0.15;
  if (kwHits >= 2) hasPrimarySignal = true;

  if (!hasPrimarySignal) return null;

  const remainingPct = Math.max(0, 100 - (contract.utilisationPercentage ?? 0));
  if (remainingPct < 5) return null;
  if (ctx.estimatedValue > 0 && contract.value > 0) {
    const remaining = contract.value * (remainingPct / 100);
    if (remaining >= ctx.estimatedValue) {
      score += 0.2;
      reasons.push(`has ~${formatValue(remaining)} remaining capacity`);
    }
  }

  return score >= 0.3 ? { score, reasons } : null;
}

export function matchContracts(
  demand: Pick<IntakeDemand, 'text' | 'category' | 'estimatedValue' | 'supplierId'>,
  contracts: Contract[],
  formatValue: (n: number) => string,
): { matches: ScoredContract[]; ruledOut?: string } {
  if (!demand.text && !demand.supplierId) {
    return { matches: [], ruledOut: 'Nothing captured yet to match against.' };
  }
  const tokens = tokenize(demand.text);
  const out: ScoredContract[] = [];
  for (const c of contracts) {
    const m = scoreContract(
      c,
      { tokens, category: demand.category, estimatedValue: demand.estimatedValue, supplierId: demand.supplierId },
      formatValue,
    );
    if (m) out.push({ contract: c, ...m });
  }
  if (out.length === 0) {
    return { matches: [], ruledOut: 'No active contract appears to cover this.' };
  }
  return { matches: out.sort((a, b) => b.score - a.score).slice(0, 4) };
}

// ── The decision ────────────────────────────────────────────────────────────

const LLM_INTENT_TO_ROUTE: Record<string, IntakeRoute> = {
  catalogue: 'catalogue',
  'new-request': 'new-demand',
};

/**
 * Route a demand, and be able to say why.
 *
 * The LLM's `intent` is authoritative when present and honourable — api/ai.ts
 * already answers this question ("buy consulting" = new-request), and the wizard
 * used to throw the answer away and re-derive a worse one. It gets one bound:
 * an intent of `catalogue` cannot route to the catalogue when nothing survives
 * the gates, because there would be nothing to order. Then the rules decide and
 * the disagreement is recorded on `llmOverruled` rather than hidden.
 *
 * `navigation` and `general` are not demand intents; they carry no routing
 * information here, so the rules decide and nothing is overruled.
 */
export function decideIntakeRoute(
  demand: IntakeDemand,
  data: RoutingData,
  config: PolicyConfig = getActivePolicyConfig(),
  formatValue: (n: number) => string = (n) => String(Math.round(n)),
): RouteDecision {
  const cat = matchCatalogue(demand, data.catalogueItems, data.catalogueEligibleCategories, config);
  const con = matchContracts(demand, data.contracts, formatValue);

  const ruledOut: Partial<Record<IntakeRoute, string>> = {};
  if (cat.ruledOut) ruledOut.catalogue = cat.ruledOut;
  if (con.ruledOut) ruledOut.contract = con.ruledOut;

  const base = {
    catalogueMatches: cat.matches,
    contractMatches: con.matches,
    ruledOut,
  };

  // The rules' own answer, computed first so it is available as the fallback.
  const rules: { route: IntakeRoute; reasons: string[]; confidence: RouteDecision['confidence'] } =
    cat.matches.length > 0
      ? {
          route: 'catalogue',
          reasons: [`${cat.matches.length} catalogue item${cat.matches.length === 1 ? '' : 's'} cover this demand`],
          confidence: cat.matches[0].score >= config.catalogueMatchThreshold * 2 ? 'high' : 'medium',
        }
      : con.matches.length > 0
        ? {
            route: 'contract',
            reasons: [`${con.matches[0].contract.title} may already cover this`, ...con.matches[0].reasons],
            confidence: con.matches[0].score >= 0.8 ? 'high' : 'medium',
          }
        : {
            route: 'new-demand',
            reasons: [
              cat.ruledOut ?? 'No catalogue item covers this.',
              con.ruledOut ?? 'No active contract covers this.',
            ],
            confidence: 'high',
          };

  const llmRoute = demand.llmIntent ? LLM_INTENT_TO_ROUTE[demand.llmIntent] : undefined;

  if (!llmRoute) {
    return { ...base, decidedBy: 'rules', ...rules };
  }

  // The one bound on "authoritative": you cannot order from an empty catalogue.
  if (llmRoute === 'catalogue' && cat.matches.length === 0) {
    return {
      ...base,
      decidedBy: 'rules',
      ...rules,
      llmOverruled: `The assistant read this as a catalogue order, but ${
        (cat.ruledOut ?? 'no item matched').charAt(0).toLowerCase() + (cat.ruledOut ?? 'no item matched').slice(1)
      }`,
    };
  }

  return {
    ...base,
    route: llmRoute,
    decidedBy: 'llm',
    confidence: 'high',
    reasons:
      llmRoute === rules.route
        ? ['The assistant and the routing rules agree', ...rules.reasons]
        : ['Routed from the assistant’s reading of the request'],
  };
}
