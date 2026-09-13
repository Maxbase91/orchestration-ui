// Reading the governed thresholds with a caller-supplied client.
//
// Mirrors tickets-core.ts and approvals-core.ts: the browser holds the
// /api/db singleton and the serverless handlers hold the privileged in-process
// one, and src/lib/db/* imports the '@/'-aliased client that Vercel cannot
// resolve at runtime. Relative '.js' specifiers only.
//
// This was private to api/governed-checkout.ts. It has to be shared now that
// approval bands and routing conditions reference governed thresholds by name:
// a caller that resolves those against DEFAULT_POLICY_CONFIG rather than the
// stored row gets a plausible wrong answer with nothing logged.
import type { NeonCompatibleClient, DbRow } from '../neon-compatible-client.js';
import { DEFAULT_POLICY_CONFIG, type PolicyConfig } from '../procurement/policy-config.js';

/**
 * Merge a stored config over the defaults, key by key.
 *
 * Per-key rather than all-or-nothing: rejecting the whole row when one key is
 * absent turned adding a field to PolicyConfig into a silent reversion of every
 * admin-configured threshold. A key whose stored type does not match the
 * default's is also defaulted, so a hand-edited row cannot feed a string into a
 * numeric comparison.
 */
export function policyConfigFromRow(row: DbRow | undefined | null): PolicyConfig {
  const candidate = (row?.config ?? {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...DEFAULT_POLICY_CONFIG };
  for (const [key, fallback] of Object.entries(DEFAULT_POLICY_CONFIG)) {
    const stored = candidate[key];
    if (stored === undefined || stored === null) continue;
    if (Array.isArray(fallback) !== Array.isArray(stored)) continue;
    if (typeof stored !== typeof fallback) continue;
    merged[key] = stored;
  }
  return merged as unknown as PolicyConfig;
}

/**
 * The governed thresholds, or the shipped defaults when the table is absent.
 *
 * A missing relation is tolerated because the table is additive — a deployment
 * that has not run the migration should still work. Any other failure is
 * swallowed to defaults too, deliberately: every caller here is on a path that
 * must produce an answer (deriving approvers, resolving a chain), and refusing
 * to answer is worse than answering on defaults. Callers that must not degrade
 * silently should read the row themselves.
 */
export async function loadPolicyConfigWith(client: NeonCompatibleClient): Promise<PolicyConfig> {
  try {
    const { data } = await client
      .from('procurement_policy_configs')
      .select('config')
      .eq('singleton_key', 'default')
      .maybeSingle();
    return policyConfigFromRow(data as DbRow | null);
  } catch {
    return DEFAULT_POLICY_CONFIG;
  }
}
