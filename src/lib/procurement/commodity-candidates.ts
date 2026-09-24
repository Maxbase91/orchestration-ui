// Explainable commodity/service-family candidates for the unified intake.
// Pure over the categories' configured codes (see category-code.ts), so the
// browser and the commodity-match handler rank the same book the same way; the
// server/API remains authoritative for persisted routing decisions.

import { keywordHits, normaliseForMatch, type CommodityCodeBook } from './category-code.js';
import type { CommodityClassificationCandidate } from '../../data/types.js';

/** Return ranked candidates using keyword evidence and conservative defaults. */
export function resolveCommodityCandidates(
  text: string,
  category: string | undefined,
  book: CommodityCodeBook,
): CommodityClassificationCandidate[] {
  const query = normaliseForMatch(text);
  const candidates = book.entries.map((entry) => {
    // The same matcher as resolveCategoryCode, so the two never disagree on
    // whether a word was in the description.
    const matches = keywordHits(query, entry.keywords);
    if (matches === 0) return null;
    return {
      code: entry.code,
      label: entry.label,
      probability: Math.min(0.99, 0.72 + matches * 0.1),
      reason: `Matched ${matches === 1 ? 'a term' : `${matches} terms`} in the request description.`,
      source: 'rules' as const,
      matches,
      own: entry.category === category,
    };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (candidates.length === 0 && category) {
    const fallback = book.defaults[category];
    if (fallback) {
      return [{ ...fallback, probability: 0.5, reason: 'No specific term was confirmed yet; this is a category placeholder.', source: 'rules' }];
    }
  }

  // Ties go to the demand's own category, then book order — the same rule as
  // resolveCategoryCode, so the headline code and the first candidate agree.
  const ranked = candidates
    .sort((a, b) => b.probability - a.probability || b.matches - a.matches || Number(b.own) - Number(a.own))
    .map(({ matches: _matches, own: _own, ...candidate }) => candidate);
  const highConfidence = ranked.filter((candidate) => candidate.probability >= 0.9);
  return highConfidence.length > 0 ? highConfidence.slice(0, 3) : ranked.slice(0, 1);
}
