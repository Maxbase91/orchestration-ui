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
  const body = await response.json() as ContractMatchResponse & { error?: string };
  if (!response.ok) throw new Error(body.error ?? 'Contract matching is temporarily unavailable.');
  return body;
}
