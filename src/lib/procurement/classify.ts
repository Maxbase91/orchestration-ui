// Deterministic demand classifier (CLS-02).
//
// The single source of truth for keyword-based category classification, used by
// the intake step as the local fallback when the governed LLM classifier
// (AI-001) is unavailable, and benchmarked by the classification eval harness
// (CLS-G1, tests/integration/classification-eval.mjs).
//
// Rules are evaluated in order, first-match-wins. The order encodes precedence:
// a "consulting" intent outranks the broad "services" bucket, etc. Anything that
// matches no rule falls through to the default commodity category.

import type { RequestCategory } from '@/data/types';

export interface CategoryRule {
  category: RequestCategory;
  pattern: RegExp;
}

export const DEFAULT_CATEGORY: RequestCategory = 'goods';

/**
 * `catalogue` is a FULFILMENT ROUTE, not a commodity category.
 *
 * It sits in the rule list because a demand for paper or toner is a strong
 * catalogue signal and the eval benchmarks it as such. But it answers "how is
 * this bought", not "what is being bought" — and the wizard keys its entire
 * journey off the category (`isCatalogue`), so letting a classifier assign it
 * silently reconfigures the whole flow and skips the funnel that is supposed to
 * decide the route. `classifyCommodityCategory` is the variant for callers that
 * need the commodity answer only.
 */
export const ROUTE_LIKE_CATEGORY: RequestCategory = 'catalogue';

export const CATEGORY_RULES: CategoryRule[] = [
  { category: 'consulting', pattern: /consult|advisory|strategy|audit|transformation|business consult|operating model|tom\b|organisational|organizational|change management|programme management|program management|due diligence|feasibility|business case|maturity assessment|roadmap|target state/ },
  { category: 'services', pattern: /\bservice\b|cleaning|catering|maintenance|travel|translation|managed print|managed service|facilities|security guard|payroll|hr admin|helpdesk/ },
  { category: 'software', pattern: /software|saas|license|cloud|platform|subscription|app/ },
  { category: 'contingent-labour', pattern: /temp|contractor|staff|developer|freelance|hire|interim/ },
  { category: 'contract-renewal', pattern: /renew|extend|renewal|expir/ },
  { category: 'supplier-onboarding', pattern: /onboard|new supplier|new vendor|register/ },
  { category: 'catalogue', pattern: /paper|pen|toner|cable|headset|mouse|keyboard|office supplies/ },
];

/**
 * Classify a free-text demand into a commodity category using the keyword
 * rules. Deterministic and side-effect free.
 */
export function classifyDemandCategory(text: string): RequestCategory {
  const q = text.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(q)) return rule.category;
  }
  return DEFAULT_CATEGORY;
}

/**
 * Classify a demand into a COMMODITY category, never a fulfilment route.
 *
 * Same rules, with the route-like `catalogue` rule skipped — so "printer paper
 * and toner" comes back as `goods`, which is what it is. The catalogue is then
 * offered, or not, by the staged funnel (`decideIntakeRoute`), which is the one
 * place that decision belongs.
 *
 * Deliberately a separate function rather than a change to
 * `classifyDemandCategory`: that one is the benchmarked classifier (CLS-G1) and
 * its `catalogue` label is a genuine, measured signal. Two questions, two
 * functions, rather than one answer that is wrong for half its callers.
 */
/**
 * Did a category rule actually match, or did we fall back to the default?
 *
 * `classifyDemandCategory` always answers, because every demand needs a
 * category — but "it answered" is not "this is a demand". The command bar
 * needed the difference: it decided what was a demand from a hardcoded list of
 * buy verbs, so "business consulting", "IT strategy consulting with Accenture"
 * and "cleaning services for the Berlin office" were not demands and went to
 * the chat assistant instead of into intake. Naming something procurable is
 * every bit as much a demand as saying "buy" in front of it.
 */
export function matchesDemandCategory(text: string): boolean {
  const q = text.toLowerCase();
  return CATEGORY_RULES.some((rule) => rule.pattern.test(q));
}

export function classifyCommodityCategory(text: string): RequestCategory {
  const q = text.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.category === ROUTE_LIKE_CATEGORY) continue;
    if (rule.pattern.test(q)) return rule.category;
  }
  return DEFAULT_CATEGORY;
}
