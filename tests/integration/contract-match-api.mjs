#!/usr/bin/env node
// Read-only live endpoint verification. It checks that normalized Neon scope
// data is exposed through the server matcher without creating request data.
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

const env = { ...process.env };
try {
  for (const line of readFileSync(new URL('../../.env.local', import.meta.url), 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i > 0 && !line.trimStart().startsWith('#') && !(line.slice(0, i).trim() in env)) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, '');
  }
} catch { /* CI supplies environment variables. */ }
const connectionString = env.NEON_DATABASE_URL ?? env.DATABASE_URL;
if (!connectionString) { console.log('contract-match-api skipped: Neon is not configured.'); process.exit(0); }
process.env.NEON_DATABASE_URL = connectionString;
const sql = neon(connectionString);
const { default: handler } = await import('../../src/server/api/contract-match.ts');
const response = { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
const rows = await sql.query(`SELECT c.category FROM contracts c JOIN contract_scope_versions sv ON sv.contract_id = c.id WHERE sv.completeness = 'complete' LIMIT 1`);
if (!rows[0]) { console.log('contract-match-api skipped: no complete contract scope.'); process.exit(0); }
await handler({ method: 'POST', body: { text: 'We need implementation support for the UK team', category: rows[0].category, estimatedValue: 1000 } }, response);
if (response.statusCode !== 200 || !response.body || !Array.isArray(response.body.candidates) || !['contract', 'clarify', 'full-request'].includes(response.body.route)) {
  console.error('contract-match-api failed:', response.statusCode, response.body);
  process.exit(1);
}
console.log(`Contract match API passed (${response.body.route}, ${response.body.candidates.length} candidate(s)).`);
