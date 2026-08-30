#!/usr/bin/env node
// Live Neon verification for policy singleton persistence and validation.
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(new URL('../../.env.local', import.meta.url), 'utf8').split('\n')) {
      const separator = line.indexOf('=');
      if (separator > 0 && !line.trimStart().startsWith('#') && !(line.slice(0, separator).trim() in env)) env[line.slice(0, separator).trim()] = line.slice(separator + 1).trim().replace(/^"|"$/g, '');
    }
  } catch { /* CI supplies environment variables. */ }
  return env;
}

const env = loadEnv();
const connectionString = env.NEON_DATABASE_URL ?? env.DATABASE_URL;
if (!connectionString) { console.log('policy-config-server skipped: Neon is not configured.'); process.exit(0); }
process.env.NEON_DATABASE_URL = connectionString;
const sql = neon(connectionString);
const { default: handler } = await import('../../api/policy-config.ts');

function invoke(method, body) {
  let statusCode = 200; let responseBody;
  const response = { status(code) { statusCode = code; return response; }, json(value) { responseBody = value; return response; } };
  return Promise.resolve(handler({ method, body }, response)).then(() => ({ statusCode, body: responseBody }));
}

const before = await invoke('GET');
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
