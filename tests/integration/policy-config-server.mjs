#!/usr/bin/env node
// Live Neon verification for policy singleton persistence and validation.
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { loadEnv, requireConnection, skipIfUnreachable, skipLive } from '../lib/live.mjs';


const env = loadEnv();
const connectionString = requireConnection('policy-config-server');
process.env.NEON_DATABASE_URL = connectionString;
const sql = neon(connectionString);
const { default: handler } = await import('../../src/server/api/policy-config.ts');

function invoke(method, body) {
  let statusCode = 200; let responseBody;
  const response = { status(code) { statusCode = code; return response; }, json(value) { responseBody = value; return response; } };
  return Promise.resolve(handler({ method, body }, response)).then(() => ({ statusCode, body: responseBody }));
}

let before;
try {
  before = await invoke('GET');
} catch (error) {
  skipIfUnreachable('policy-config-server', error);
}
if (before.statusCode === 500 && before.body?.code === 'policy_config_unavailable') {
  skipLive('policy-config-server', 'the configured Neon database did not respond');
}
const original = before.body?.config;
let failures = 0;
const check = (label, condition, detail = '') => { if (condition) console.log(`  ✓ ${label}`); else { failures += 1; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); } };
try {
  const changed = { ...original, catalogueAutoApprovalThreshold: Number(original.catalogueAutoApprovalThreshold) + 1 };
  const saved = await invoke('POST', { config: changed, updatedBy: 'policy-config-test' });
  check('valid config saves', saved.statusCode === 200 && saved.body?.config?.catalogueAutoApprovalThreshold === changed.catalogueAutoApprovalThreshold, JSON.stringify(saved));
  const loaded = await invoke('GET');
  check('saved config loads from Neon', loaded.statusCode === 200 && loaded.body?.config?.catalogueAutoApprovalThreshold === changed.catalogueAutoApprovalThreshold);
  const invalid = await invoke('POST', { config: { ...changed, minCompetitiveQuotes: 0 } });
  check('invalid config is rejected', invalid.statusCode === 400 && invalid.body?.code === 'invalid_policy_config');
} finally {
  if (original) await invoke('POST', { config: original, updatedBy: before.body?.updatedBy ?? 'policy-config-test-restore' });
  await sql.query(`DELETE FROM procurement_policy_configs WHERE updated_by = 'policy-config-test'`);
}
if (failures) process.exitCode = 1;
else console.log('Server policy-config checks passed.');
