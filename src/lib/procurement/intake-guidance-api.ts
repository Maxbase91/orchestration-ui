// Browser seam for contextual requester guidance. Guidance is optional and
// never controls routing or persistence.

export interface IntakeGuidanceSuggestion {
  id: string;
  text: string;
  sourceType: 'similar approved request' | 'configured template';
  rationale: string;
}

// Guidance is optional and can appear beside several fields while the user
// moves through the wizard. A short in-memory cache avoids repeating the same
// read on every render without persisting requester context in the browser.
const CACHE_TTL_MS = 60_000;
const guidanceCache = new Map<string, { expiresAt: number; suggestions: IntakeGuidanceSuggestion[] }>();

export async function requestIntakeGuidance(input: { category?: string; section: string; text?: string; commodityCode?: string }, signal?: AbortSignal): Promise<IntakeGuidanceSuggestion[]> {
  const key = JSON.stringify(input);
  const cached = guidanceCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.suggestions;
  const response = await fetch('/api/intake-guidance', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal,
  });
  const body = await response.json() as { suggestions?: IntakeGuidanceSuggestion[]; error?: string };
  if (!response.ok) throw new Error(body.error ?? 'Guidance is temporarily unavailable.');
  const suggestions = Array.isArray(body.suggestions) ? body.suggestions : [];
  guidanceCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, suggestions });
  return suggestions;
}
