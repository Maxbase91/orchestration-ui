// Deterministic demand classifier (CLS-02) — the configured keywords.
//
// Used when the AI classifier (AI-001) is off or unavailable, by the Home box
// to recognise a demand, and benchmarked by the classification eval (CLS-G1,
// tests/integration/classification-eval.mjs).
//
// The keywords were a regex list here that no admin could see or change, and
// several matched inside other words ("pen" in "spend", "app" in "approval").
// They are each category's `keywords` now (Admin → Categories), matched at the
// start of a word, and the category order is the precedence: the first
// category whose keywords match wins — consulting before the broad services
// bucket, and so on. Nothing matching falls to the default category.
//
// Pure: the caller passes the configured categories. Relative imports only.

import type { RequestCategory } from '../../data/types.js';
import { keywordHits, normaliseForMatch } from './category-code.js';

/** What the classifier reads from a category. */
export interface ClassifierCategory {
  id: string;
  keywords?: string[];
  active?: boolean;
  sortOrder?: number;
}

/** The category a demand falls to when no keyword matches. */
export const DEFAULT_CATEGORY: RequestCategory = 'goods';

/**
 * `catalogue` is a FULFILMENT ROUTE, not a commodity category.
 *
 * A demand for paper or toner is a strong catalogue signal and the eval
 * benchmarks it as such, but it answers "how is this bought", not "what is
 * being bought" — and letting a classifier assign it would reconfigure the
 * journey before the funnel decides the route. `classifyCommodityCategory` is
 * the variant for callers that need the commodity answer only.
 */
export const ROUTE_LIKE_CATEGORY: RequestCategory = 'catalogue';

function ordered(categories: ClassifierCategory[]): ClassifierCategory[] {
  return categories
    .filter((c) => c.active !== false && (c.keywords?.length ?? 0) > 0)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function firstMatch(text: string, categories: ClassifierCategory[], skip?: string): string | null {
  const normalised = normaliseForMatch(text);
  for (const category of ordered(categories)) {
    if (category.id === skip) continue;
    if (keywordHits(normalised, category.keywords ?? []) > 0) return category.id;
  }
  return null;
}

/** Classify a free-text demand into a category, by the configured keywords. */
export function classifyDemandCategory(text: string, categories: ClassifierCategory[]): RequestCategory {
  return firstMatch(text, categories) ?? DEFAULT_CATEGORY;
}

/**
 * Did a category's keywords actually match, or did we fall back to the default?
 *
 * `classifyDemandCategory` always answers, because every demand needs a
 * category — but "it answered" is not "this is a demand". The command bar
 * needs the difference: naming something procurable ("business consulting",
 * "cleaning services for the Berlin office") is a demand as much as saying
 * "buy" in front of it.
 */
export function matchesDemandCategory(text: string, categories: ClassifierCategory[]): boolean {
  return firstMatch(text, categories) !== null;
}

/**
 * Classify a demand into a COMMODITY category, never a fulfilment route: the
 * same keywords with the route-like `catalogue` skipped, so "printer paper and
 * toner" comes back as goods. The catalogue is then offered, or not, by the
 * funnel (`decideIntakeRoute`), which is the one place that decision belongs.
 */
export function classifyCommodityCategory(text: string, categories: ClassifierCategory[]): RequestCategory {
  return firstMatch(text, categories, ROUTE_LIKE_CATEGORY) ?? DEFAULT_CATEGORY;
}
