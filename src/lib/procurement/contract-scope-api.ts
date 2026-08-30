// Browser seam for contract coverage administration. The server endpoint
// validates and persists normalized scope versions; callers never write tables directly.
import type { ContractScopeDeliverable, ContractScopeExclusion, ContractScopeVersion } from '@/data/types';

export interface ContractScopeAggregate { scope: ContractScopeVersion | null; deliverables: ContractScopeDeliverable[]; exclusions: ContractScopeExclusion[]; versions: ContractScopeVersion[] }
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(10_000) });
  const body = await response.json() as { error?: string } & T;
  if (!response.ok) throw new Error(body.error ?? 'Contract coverage is unavailable.');
  return body;
}
export function loadContractScope(contractId: string): Promise<ContractScopeAggregate> { return request<ContractScopeAggregate>(`/api/contract-scope?id=${encodeURIComponent(contractId)}`); }
export function saveContractScope(contractId: string, scope: Partial<ContractScopeVersion>, deliverables: ContractScopeDeliverable[], exclusions: ContractScopeExclusion[]): Promise<{ id: string; savedAt: string }> {
  return request<{ id: string; savedAt: string }>('/api/contract-scope', { method: 'POST', body: JSON.stringify({ contractId, scope, deliverables, exclusions }) });
}
