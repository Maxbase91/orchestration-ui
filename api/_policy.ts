// The governed thresholds, server side.
//
// `PolicyConfig` is a Postgres singleton (`procurement_policy_configs`) edited
// at /admin/thresholds. The browser hydrates a module-level copy in
// src/main.tsx via `applyPolicyOverrides`, so `getActivePolicyConfig()` is
// correct there and **wrong everywhere under `api/`**: nothing in a serverless
// cold start ever calls that hydration, so a route reaching for the active
// config — or defaulting to `DEFAULT_POLICY_CONFIG` — evaluates against shipped
// numbers while the admin's saved thresholds sit in Neon. A wrong answer with
// nothing logged.
//
// `api/governed-checkout.ts` has read the row properly since ADR-0002. This is
// that loader extracted, unchanged, so the other routes stop restating the
// defaults: `api/generate-sow.ts` and `api/chat-intake.ts` both passed
// `DEFAULT_POLICY_CONFIG` into condition evaluation, so a `policy:<key>` token
// on a service-description condition resolved to the shipped number and an
// admin's edit moved the browser and not generation.
import { getNeonClient, isMissingRelation, queryRows, type DbRow } from './_neon.js';
import { DEFAULT_POLICY_CONFIG, type PolicyConfig } from '../src/lib/procurement/policy-config.js';

function isRecord(value: unknown): value is DbRow {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

/**
 * Merge a stored policy row over the shipped defaults, key by key.
 *
 * This used to reject the whole row if any single key was absent and fall back
 * to DEFAULT_POLICY_CONFIG entirely. That turned adding one field to
 * PolicyConfig into a silent reversion of every admin-configured threshold: the
 * stored row predates the new key, the guard fires, and live checkout starts
 * deciding on shipped defaults with nothing logged. Taking each key on its own
 * merits keeps the configured values and defaults only what is genuinely
 * missing.
 *
 * A key whose stored type does not match the default's is also defaulted, so a
 * hand-edited row cannot feed a string threshold into a numeric comparison.
 */
export function configFromRow(row: DbRow | undefined): PolicyConfig {
  const value = row?.config;
  if (!isRecord(value)) return DEFAULT_POLICY_CONFIG;
  const candidate = value as Record<string, unknown>;
  const merged = { ...DEFAULT_POLICY_CONFIG } as Record<string, unknown>;
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
 * The thresholds this request must be decided against.
 *
 * Takes a client so a caller already inside a transaction or holding its own
 * connection reuses it, mirroring the `-core.ts` pattern in `src/lib/db`.
 */
export async function loadPolicyConfigWith(
  sql: ReturnType<typeof getNeonClient>,
): Promise<PolicyConfig> {
  try {
    const rows = await queryRows(
      sql, 'SELECT config FROM procurement_policy_configs WHERE singleton_key = $1', ['default'],
    );
    return configFromRow(rows[0]);
  } catch (error) {
    // The policy table is additive. A deployment that has not run the migration
    // still uses shipped defaults rather than becoming unusable. Anything else —
    // a permissions or connection failure — must surface, not quietly hand this
    // caller a different rulebook than the admin configured.
    if (isMissingRelation(error)) return DEFAULT_POLICY_CONFIG;
    throw error;
  }
}

/** The same, for a caller with no client of its own. */
export async function loadPolicyConfig(): Promise<PolicyConfig> {
  return loadPolicyConfigWith(getNeonClient());
}
