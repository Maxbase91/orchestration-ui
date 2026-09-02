// Browser seam for contract matching. The API is authoritative; callers can
// still use their deterministic preview when the server is temporarily down.

import type { ContractMatchResponse } from '../../data/types';
import type { ContractMatchInput } from './contract-matching';

export async function requestContractMatch(input: ContractMatchInput, signal?: AbortSignal): Promise<ContractMatchResponse> {
  const response = await fetch('/api/contract-match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });
  const body = await response.json() as Partial<ContractMatchResponse> & { error?: string };
  if (!response.ok) throw new Error(body.error ?? 'Contract matching is temporarily unavailable.');

  // Normalised, not cast. `as ContractMatchResponse` on a parsed body is a
  // promise TypeScript cannot keep: the caller does `serverMatch.candidates.map`
  // unguarded, so a body without that key takes down the whole pre-check screen
  // with "Cannot read properties of undefined". That is the same shape as the
  // `?.trim is not a function` and missing-`.contains()` crashes — a value from
  // outside trusted because a cast said so. Every array the type promises is
  // an array here.
  return {
    sufficient: body.sufficient === true,
    route: body.route ?? 'full-request',
    missingFields: Array.isArray(body.missingFields) ? body.missingFields : [],
    questions: Array.isArray(body.questions) ? body.questions : [],
    candidates: Array.isArray(body.candidates) ? body.candidates : [],
  };
}
