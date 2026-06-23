// Second contract check (after the full service description).
//
// The intake (first) check is a light catalogue/contract deflection. This richer
// check runs against the captured demand and surfaces the contracts that already
// cover the supplier — distinguishing directly **transactable** contracts from
// **frameworks / master agreements** under which a statement of work can be
// authored. Standardised; reads contracts (own store today) supplied by the
// caller, so it works the same when a live contract source is wired in.

import type { Contract } from '@/data/types';

export type ContractKind = 'transactable' | 'framework' | 'expiring';
export type SecondCheckRecommendation = 'transact' | 'author-sow' | 'renew' | 'new-contract';

/** Headroom: a contract at/above this utilisation can't absorb more directly. */
export const UTILISATION_HEADROOM = 95;
/** Days before expiry within which a contract is flagged as expiring. */
export const EXPIRY_BUFFER_DAYS = 60;

export interface SecondContractCheckInput {
  supplierId?: string;
  category?: string;
  /** ISO date (caller-supplied to keep this pure). */
  now: string;
  contracts: Contract[];
}

export interface ContractCandidate {
  contractId: string;
  title: string;
  kind: ContractKind;
  endDate: string;
  utilisationPercentage: number;
  reason: string;
}

export interface SecondContractCheckResult {
  candidates: ContractCandidate[];
  recommendation: SecondCheckRecommendation;
  reason: string;
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) return Infinity;
  return Math.round((to - from) / 86_400_000);
}

/**
 * Classify the contracts covering the supplier/category and recommend the route:
 * transact under a usable contract, author a SOW under a framework, renew an
 * expiring one, or proceed to a new contract.
 */
export function runSecondContractCheck(input: SecondContractCheckInput): SecondContractCheckResult {
  const candidates: ContractCandidate[] = [];

  for (const c of input.contracts) {
    if (input.supplierId && c.supplierId !== input.supplierId) continue;
    if (input.category && c.category && c.category !== input.category) continue;
    if (c.status === 'expired' || c.status === 'terminated') continue;
    if (c.endDate && c.endDate < input.now) continue;

    const expiringSoon = c.status === 'expiring' || daysBetween(input.now, c.endDate) <= EXPIRY_BUFFER_DAYS;

    let kind: ContractKind;
    let reason: string;
    if (c.isFramework) {
      kind = 'framework';
      reason = 'Framework / master agreement — author a SOW under it';
    } else if (expiringSoon) {
      kind = 'expiring';
      reason = 'Active but expiring — renew or extend before relying on it';
    } else if (c.status === 'active' && c.utilisationPercentage < UTILISATION_HEADROOM) {
      kind = 'transactable';
      reason = `Active with headroom (${c.utilisationPercentage}% utilised) — transact directly`;
    } else {
      kind = 'framework';
      reason = 'Active but fully utilised — treat as a framework and author a SOW';
    }
    candidates.push({ contractId: c.id, title: c.title, kind, endDate: c.endDate, utilisationPercentage: c.utilisationPercentage, reason });
  }

  // Pick the strongest route across candidates.
  if (candidates.some((c) => c.kind === 'transactable')) {
    return { candidates, recommendation: 'transact', reason: 'A usable contract covers this demand — transact directly.' };
  }
  if (candidates.some((c) => c.kind === 'framework')) {
    return { candidates, recommendation: 'author-sow', reason: 'A framework / master agreement is in place — author a SOW under it.' };
  }
  if (candidates.some((c) => c.kind === 'expiring')) {
    return { candidates, recommendation: 'renew', reason: 'The covering contract is expiring — renew or extend it.' };
  }
  return { candidates, recommendation: 'new-contract', reason: 'No contract covers this demand — a new contract is required.' };
}
