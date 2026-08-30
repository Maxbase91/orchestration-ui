// Browser client for the server-owned policy singleton. Defaults remain a
// safe fallback when the API is unavailable during local development.
import type { PolicyConfig } from './policy-config';

interface PolicyResponse { config: PolicyConfig; updatedBy?: string | null; updatedAt?: string | null }

async function request<T>(init?: RequestInit): Promise<T> {
  const response = await fetch('/api/policy-config', { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(10_000) });
  const body = await response.json() as { error?: string; code?: string } & T;
  if (!response.ok) throw new Error(body.error ?? 'Policy configuration is unavailable.');
  return body;
}

export function loadPolicyConfig(): Promise<PolicyResponse> { return request<PolicyResponse>(); }

export function savePolicyConfig(config: PolicyConfig, updatedBy?: string): Promise<PolicyResponse> {
  return request<PolicyResponse>({ method: 'POST', body: JSON.stringify({ config, updatedBy }) });
}

export function resetPolicyConfig(updatedBy?: string): Promise<PolicyResponse> {
  return request<PolicyResponse>({ method: 'POST', body: JSON.stringify({ action: 'reset', updatedBy }) });
}
