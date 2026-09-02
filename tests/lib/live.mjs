// Shared helpers for the suites that need a live Neon database.
//
// Why this exists: each of those suites used to `process.exit(0)` when the
// database was unconfigured or unreachable — reporting PASS while asserting
// nothing. In any sandbox or CI runner without NEON_DATABASE_URL the whole live
// set was green by default, and those are the suites the ADRs cite as evidence
// for checkout atomicity and idempotency.
//
// A skip now exits SKIP_EXIT_CODE, which the aggregate runner counts separately
// from a pass, and REQUIRE_LIVE=1 turns a skip into a failure so a pipeline that
// is supposed to have a database says so when it doesn't.
//
// `neonClient` below is the other half: the suites that used to build their own
// legacy client now get a Neon-backed one with the same query surface, so they
// assert against the system of record instead of skipping forever.

import { readFileSync } from 'node:fs';

/** Distinct from 0 (pass) and 1 (fail) so a runner can tell the three apart. */
export const SKIP_EXIT_CODE = 3;

/** Connection failures that mean "no database here", not "the code is wrong". */
const UNREACHABLE = /fetch failed|ENOTFOUND|ENETUNREACH|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN/i;

/** process.env, plus .env.local when present (CI supplies real variables). */
export function loadEnv() {
  const env = { ...process.env };
  try {
    const file = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8');
    for (const line of file.split('\n')) {
      const separator = line.indexOf('=');
      if (separator <= 0 || line.trimStart().startsWith('#')) continue;
      const key = line.slice(0, separator).trim();
      if (key in env) continue;
      env[key] = line.slice(separator + 1).trim().replace(/^"|"$/g, '');
    }
  } catch { /* no .env.local — CI supplies environment variables */ }
  return env;
}

/** End the suite as skipped, or as a failure under REQUIRE_LIVE=1. */
export function skipLive(suite, reason) {
  if (process.env.REQUIRE_LIVE === '1') {
    console.error(`FAILED: ${suite} requires a live database — ${reason}`);
    process.exit(1);
  }
  console.log(`SKIPPED: ${suite} — ${reason}`);
  process.exit(SKIP_EXIT_CODE);
}

/** The Neon connection string, or a skip when none is configured. */
export function requireConnection(suite) {
  const env = loadEnv();
  const connectionString = env.NEON_DATABASE_URL ?? env.DATABASE_URL;
  if (!connectionString) skipLive(suite, 'NEON_DATABASE_URL/DATABASE_URL is not configured');
  process.env.NEON_DATABASE_URL = connectionString;
  return connectionString;
}

/** Skip when the database is unreachable; rethrow anything that is a real failure. */
export function skipIfUnreachable(suite, error) {
  const message = error instanceof Error ? error.message : String(error);
  if (UNREACHABLE.test(message)) skipLive(suite, 'could not reach the configured database');
  throw error;
}

/**
 * Merge .env.local into process.env, as each suite's own `loadEnv` used to.
 *
 * Kept because a few suites read unrelated variables (`E2E_API_BASE`) straight
 * off process.env, and dropping this would silently change which deployment
 * they talk to.
 */
export function hydrateEnv() {
  const env = loadEnv();
  for (const [key, value] of Object.entries(env)) {
    if (!(key in process.env)) process.env[key] = value;
  }
  return env;
}

/**
 * A Neon-backed client with the legacy query surface the suites were written against.
 *
 * Ten integration suites built their own client against the retired project and asserted against a
 * database that is no longer the system of record, so they skipped on every run
 * — roughly 1,800 lines of behaviour outside the gate. Every query method they
 * use (from/select/eq/single/filter/update/limit/insert/delete/order/in/
 * maybeSingle/neq/is/like) is implemented by the compatibility client, so the
 * bodies needed no changes: only the construction did.
 *
 * The executor runs in-process rather than posting to /api/db, the same wiring
 * `api/_db-admin.ts` uses for server handlers, so a test does not need a
 * running deployment. Imports are dynamic because they cross into TypeScript —
 * these suites run under `node --import tsx/esm`.
 */
export async function neonClient(suite) {
  hydrateEnv();
  requireConnection(suite);
  const { executeNeonRequest } = await import('../../api/db.ts');
  const { NeonCompatibleClient } = await import('../../src/lib/neon-compatible-client.ts');
  return new NeonCompatibleClient(executeNeonRequest);
}
