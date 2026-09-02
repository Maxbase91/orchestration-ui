#!/usr/bin/env node
// Static guardrails for the Neon data layer.
//
// This began as a migration guard, when Supabase still existed behind a provider
// switch. The migration is finished and Supabase is gone, so most of the
// invariants have inverted: what these check now is that there is exactly one
// data path, that it cannot be pointed anywhere else, and that the properties
// bought during the cutover — column-typed parameters, filtered destructive
// writes, a normalised connection string — are still in place.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const packageJson = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
const envExample = readFileSync(new URL('../../.env.example', import.meta.url), 'utf8');
const schemaApply = readFileSync(new URL('../../db/migrations/apply-neon-schema.mjs', import.meta.url), 'utf8');
const client = readFileSync(new URL('../../src/lib/neon-compatible-client.ts', import.meta.url), 'utf8');
const browserClient = readFileSync(new URL('../../src/lib/db-client.ts', import.meta.url), 'utf8');
const endpoint = readFileSync(new URL('../../api/db.ts', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8');
const governedEndpoint = readFileSync(new URL('../../api/governed-checkout.ts', import.meta.url), 'utf8');
const policyEndpoint = readFileSync(new URL('../../src/server/api/policy-config.ts', import.meta.url), 'utf8');
const neonFactory = readFileSync(new URL('../../api/_neon.ts', import.meta.url), 'utf8');
const healthEndpoint = readFileSync(new URL('../../src/server/api/neon-health.ts', import.meta.url), 'utf8');
const dbAdmin = readFileSync(new URL('../../api/_db-admin.ts', import.meta.url), 'utf8');

// ── the name must not come back in code ────────────────────────────────────
//
// Comments are stripped before scanning, deliberately. A header explaining which
// supabase-js semantics the compatibility client preserves, or why a test used to
// remove the wrong variables, is history worth keeping — it costs nothing and
// answers a question the next reader will have. What must not return is an
// *identifier*: an import, an env var read, a client construction, a UI string.
// Those are the things that would put a second data path back, which is what let
// dev and production run different code and sent three defects to users.
//
// One file is exempt: this one, whose assertions have to name what is absent.
const SCAN_ROOTS = ['src', 'api', 'tests'];
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.mjs', '.js', '.json']);
const SCAN_EXEMPT = new Set(['tests/integration/neon-migration.mjs']);

const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = `${dir}/${entry}`;
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (SCAN_EXTENSIONS.has(entry.slice(entry.lastIndexOf('.')))) yield path;
  }
}

const repoRoot = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '');

// ── a skip helper belongs to tests, not to data repairs ────────────────────
//
// `requireConnection` skips (exit 3) when no connection is configured, which is
// right for a suite and wrong for a backfill someone typed on purpose: it writes
// nothing and says so only in an exit code. `requireConnectionOrFail` exits 1
// with what to set and where. A script under db/ reaching for the skip helper is
// the regression this pins.
const skipHelperUsers = [];
for (const path of walk(`${repoRoot}/db`)) {
  if (/\brequireConnection\b(?!OrFail)/.test(readFileSync(path, 'utf8'))) {
    skipHelperUsers.push(path.slice(repoRoot.length + 1));
  }
}
const offenders = [];
for (const root of SCAN_ROOTS) {
  for (const absolute of walk(`${repoRoot}/${root}`)) {
    const relative = absolute.slice(repoRoot.length + 1);
    if (SCAN_EXEMPT.has(relative)) continue;
    const code = stripComments(readFileSync(absolute, 'utf8'));
    const line = code.split('\n').findIndex((text) => /supabase/i.test(text));
    if (line !== -1) offenders.push(`${relative}:${line + 1}`);
  }
}

const checks = [
  ['Neon driver dependency is declared', Boolean(packageJson.dependencies?.['@neondatabase/serverless'])],
  ['no Supabase dependency remains', !packageJson.dependencies?.['@supabase/supabase-js'] && !packageJson.devDependencies?.['@supabase/supabase-js']],
  ['the stranded intake-compliance rows have a committed recovery',
    existsSync(new URL('../../db/backfills/2026-09-02-intake-compliance-records.sql', import.meta.url))
    && packageJson.scripts?.['backfill:intake-compliance']?.includes('2026-09-02-intake-compliance-records.sql')],
  // No DATABASE_PROVIDER and no SUPABASE_*: keeping them documented would
  // describe variables that no longer do anything.
  ['the private connection is documented and never VITE_-prefixed',
    envExample.includes('NEON_DATABASE_URL') && !envExample.includes('VITE_NEON')
    && !envExample.includes('DATABASE_PROVIDER=') && !envExample.includes('SUPABASE')],
  ['schema resume skips destructive statements', schemaApply.includes('shouldSkip') && schemaApply.includes('destructive/policy statements skipped')],
  ['schema includes checkout fingerprint and policy singleton', schema.includes('idempotency_fingerprint') && schema.includes('procurement_policy_configs')],
  ['atomic checkout and policy routes exist', governedEndpoint.includes('sql.transaction') && policyEndpoint.includes('procurement_policy_configs')],
  ['Neon connection strings are normalized safely', neonFactory.includes('channel_binding') && neonFactory.includes('replace(/^([\'\"])')],
  ['Neon health endpoint classifies safe failure modes', healthEndpoint.includes("return 'dns'") && healthEndpoint.includes("return 'schema'") && healthEndpoint.includes('neon_${kind}')],
  // A second data path is what let dev and production run different clients,
  // which is how three defects reached users unseen.
  ['no Supabase fallback remains on the server', !dbAdmin.includes('@supabase/supabase-js') && !dbAdmin.includes('SUPABASE_SERVICE_ROLE_KEY')],
  ['the browser has one client, not a provider switch', !client.includes('VITE_DATABASE_PROVIDER') && !browserClient.includes('createClient(')],
  ['a destructive write must be filtered', endpoint.includes('assertFilteredWrite') && endpoint.includes('An unfiltered')],
  ['browser client uses the API endpoint', client.includes("fetch('/api/db'")],
  ['query parameters are cast to their column type, not to text', endpoint.includes('castForColumn') && !endpoint.includes("return '::text';\n}")],
  ['endpoint has an explicit relation allowlist', endpoint.includes('ALLOWED_RELATIONS') && endpoint.includes('Unsupported database relation')],
  ['endpoint has an explicit function allowlist', endpoint.includes('ALLOWED_FUNCTIONS') && endpoint.includes('Unsupported database function')],
  ['ADR documents the migration decision', existsSync(new URL('../../docs/adr/0003-private-neon-database-migration.md', import.meta.url))],
  [`no Supabase identifier remains in src/, api/ or tests/${offenders.length ? ` — ${offenders.join(', ')}` : ''}`,
    offenders.length === 0],
  [`a data repair fails rather than skips without a connection${skipHelperUsers.length ? ` — ${skipHelperUsers.join(', ')}` : ''}`,
    skipHelperUsers.length === 0],
];

let failures = 0;
for (const [label, passed] of checks) {
  if (passed) console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  else { failures += 1; console.error(`  \x1b[31m✗\x1b[0m ${label}`); }
}

if (failures > 0) process.exitCode = 1;
else console.log('Neon migration guardrails passed. Live copy is skipped unless credentials are configured.');
