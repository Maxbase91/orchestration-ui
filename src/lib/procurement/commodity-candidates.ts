// Explainable commodity/service-family candidates for the unified intake.
// This pure resolver keeps classification useful offline while the server/API
// remains authoritative for persisted routing decisions.

import { KEYWORD_CODES, CATEGORY_DEFAULT_CODES } from './category-code.js';
import type { CommodityClassificationCandidate } from '../../data/types.js';

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
/** Return ranked candidates using keyword evidence and conservative defaults. */
export function resolveCommodityCandidates(text: string, category?: string): CommodityClassificationCandidate[] {
  const query = normalise(text);
  const candidates = KEYWORD_CODES.map((entry) => {
    const matches = entry.keywords.filter((keyword) => query.includes(normalise(keyword))).length;
    if (matches === 0) return null;
    return {
      code: entry.code,
      label: entry.label,
      probability: Math.min(0.99, 0.72 + matches * 0.1),
      reason: `Matched ${matches === 1 ? 'a term' : `${matches} terms`} in the request description.`,
      source: 'rules' as const,
      matches,
    };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (candidates.length === 0 && category) {
    const fallback = CATEGORY_DEFAULT_CODES[category];
    if (fallback) {
      return [{ ...fallback, probability: 0.5, reason: 'No specific term was confirmed yet; this is a category placeholder.', source: 'rules' }];
    }
  }

  const ranked = candidates
    .sort((a, b) => b.probability - a.probability || b.matches - a.matches)
    .map(({ matches: _matches, ...candidate }) => candidate);
  const highConfidence = ranked.filter((candidate) => candidate.probability >= 0.9);
  return highConfidence.length > 0 ? highConfidence.slice(0, 3) : ranked.slice(0, 1);
}
