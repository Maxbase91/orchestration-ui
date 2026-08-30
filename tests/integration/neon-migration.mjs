#!/usr/bin/env node
// Static guardrails for the private-Neon migration path. Live migration tests
// run only when both source and target credentials are explicitly configured.
import { readFileSync, existsSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
const envExample = readFileSync(new URL('../../.env.example', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../../supabase/migrations/migrate-supabase-to-neon.mjs', import.meta.url), 'utf8');
const schemaApply = readFileSync(new URL('../../supabase/migrations/apply-neon-schema.mjs', import.meta.url), 'utf8');
const client = readFileSync(new URL('../../src/lib/neon-compatible-client.ts', import.meta.url), 'utf8');
const endpoint = readFileSync(new URL('../../api/db.ts', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../../supabase/schema.sql', import.meta.url), 'utf8');
const governedEndpoint = readFileSync(new URL('../../api/governed-checkout.ts', import.meta.url), 'utf8');
const policyEndpoint = readFileSync(new URL('../../src/server/api/policy-config.ts', import.meta.url), 'utf8');

const checks = [
  ['Neon driver dependency is declared', Boolean(packageJson.dependencies?.['@neondatabase/serverless'])],
  ['migration script is registered', packageJson.scripts?.['migrate:supabase-to-neon'] === 'node supabase/migrations/migrate-supabase-to-neon.mjs'],
  ['server-only Neon variables are documented', envExample.includes('NEON_DATABASE_URL') && envExample.includes('DATABASE_PROVIDER')],
  ['migration is non-destructive', migration.includes('ON CONFLICT DO NOTHING') && !migration.includes('TRUNCATE') && !migration.includes('DROP TABLE')],
  ['schema resume skips destructive statements', schemaApply.includes('shouldSkip') && schemaApply.includes('destructive/policy statements skipped')],
  ['schema includes checkout fingerprint and policy singleton', schema.includes('idempotency_fingerprint') && schema.includes('procurement_policy_configs')],
  ['atomic checkout and policy routes exist', governedEndpoint.includes('sql.transaction') && policyEndpoint.includes('procurement_policy_configs')],
  ['browser client uses the API endpoint', client.includes("fetch('/api/db'")],
  ['endpoint has an explicit relation allowlist', endpoint.includes('ALLOWED_RELATIONS') && endpoint.includes('Unsupported database relation')],
  ['endpoint has an explicit function allowlist', endpoint.includes('ALLOWED_FUNCTIONS') && endpoint.includes('Unsupported database function')],
  ['ADR documents the migration decision', existsSync(new URL('../../docs/adr/0003-private-neon-database-migration.md', import.meta.url))],
];

let failures = 0;
for (const [label, passed] of checks) {
  if (passed) console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  else { failures += 1; console.error(`  \x1b[31m✗\x1b[0m ${label}`); }
}

if (failures > 0) process.exitCode = 1;
else console.log('Neon migration guardrails passed. Live copy is skipped unless credentials are configured.');
