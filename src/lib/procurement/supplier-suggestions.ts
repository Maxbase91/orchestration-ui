// Suppliers worth suggesting for a demand — the ranking behind AI-005, the
// supplier recommender: category fit × performance × risk, the category's
// preferred suppliers first. Moved out of the retired Details step's supplier
// card so the conversation's supplier turn can offer them as answers; the
// ranking is unchanged.
//
// Pure, with relative imports, so a node test drives it.
import type { Supplier } from '../../data/types.js';

/**
 * How well a supplier's capabilities cover a category: the share of the
 * category's supplier tags it carries. The tags are the category's own
 * (/admin/categories → "Supplier tags that cover this category"), not a map in
 * code, so a new category matches suppliers as soon as it is configured.
 */
function categoryMatchScore(supplier: Supplier, tags: readonly string[]): number {
  if (tags.length === 0) return 0;
  const caps = (supplier.categories ?? []).map((c) => c.toLowerCase());
  const hits = tags.filter((tag) => caps.some((cap) => cap.includes(tag.toLowerCase()))).length;
  return hits / tags.length;
}

const RISK_WEIGHT: Record<string, number> = { low: 1.0, medium: 0.8, high: 0.5, critical: 0.0 };

export interface SupplierSuggestion {
  supplier: Supplier;
  /** Category fit × performance × risk weight, 0..1. */
  score: number;
}

export function rankSupplierSuggestions(
  suppliers: readonly Supplier[],
  options: {
    /** The category's supplier tags. */
    tags: readonly string[];
    preferredIds: readonly string[];
    /** Already chosen or already invited. */
    exclude?: readonly string[];
    limit?: number;
  },
): SupplierSuggestion[] {
  const exclude = new Set(options.exclude ?? []);
  const preferred = new Set(options.preferredIds);
  return suppliers
    // No performance history is no basis for a suggestion.
    .filter((s) => !exclude.has(s.id) && s.performanceScore > 0)
    .map((s) => {
      // A preferred supplier for the category is a full match whatever its tags say.
      const match = preferred.has(s.id) ? 1 : categoryMatchScore(s, options.tags);
      return { supplier: s, match, score: match * (s.performanceScore / 100) * (RISK_WEIGHT[s.riskRating] ?? 0.5) };
    })
    .filter((r) => r.match > 0)
    .sort((a, b) => Number(preferred.has(b.supplier.id)) - Number(preferred.has(a.supplier.id)) || b.score - a.score)
    .slice(0, options.limit ?? 3)
    .map(({ supplier, score }) => ({ supplier, score }));
}
