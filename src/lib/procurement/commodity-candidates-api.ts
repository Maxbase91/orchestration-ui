// Browser seam for commodity candidates. The endpoint may be unavailable in
// local/static mode, so callers retain the deterministic resolver as fallback.

import type { CommodityClassificationCandidate } from '@/data/types';

export async function requestCommodityCandidates(input: { text: string; category?: string }, signal?: AbortSignal): Promise<CommodityClassificationCandidate[]> {
  const response = await fetch('/api/commodity-match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });
  const body = await response.json() as { candidates?: CommodityClassificationCandidate[]; error?: string };
  if (!response.ok) throw new Error(body.error ?? 'Classification is temporarily unavailable.');
  return Array.isArray(body.candidates) ? body.candidates : [];
}
