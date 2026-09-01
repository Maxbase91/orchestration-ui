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
 * Guard for the suites that still create their own Supabase client.
 *
 * Supabase was replaced by Neon; these suites assert against a database that is
 * no longer the system of record, and they crashed on a missing key rather than
 * skipping — ten hard failures in every run without credentials. They skip with
 * a reason that names the real work: each needs rewriting against Neon.
 */
export function requireLegacySupabase(suite) {
  const env = loadEnv();
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    skipLive(suite, 'still targets Supabase, which Neon replaced — needs migrating to the Neon store');
  }
  return { url, key };
}
