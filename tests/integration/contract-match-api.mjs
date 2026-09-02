#!/usr/bin/env node
// Read-only live endpoint verification. It checks that normalized Neon scope
// data is exposed through the server matcher without creating request data.
import { neon } from '@neondatabase/serverless';
import { requireConnection, skipLive } from '../lib/live.mjs';

// requireConnection reads .env.local and exports NEON_DATABASE_URL itself; the
// copy of that loader that used to sit here was a fourth duplicate of it.
const connectionString = requireConnection('contract-match-api');
const sql = neon(connectionString);
const { default: handler } = await import('../../src/server/api/contract-match.ts');
const response = { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
const rows = await sql.query(`SELECT c.category FROM contracts c JOIN contract_scope_versions sv ON sv.contract_id = c.id WHERE sv.completeness = 'complete' LIMIT 1`);
if (!rows[0]) skipLive('contract-match-api', 'no complete contract scope');
await handler({ method: 'POST', body: { text: 'We need implementation support for the UK team', category: rows[0].category, estimatedValue: 1000 } }, response);
if (response.statusCode !== 200 || !response.body || !Array.isArray(response.body.candidates) || !['contract', 'clarify', 'full-request'].includes(response.body.route)) {
  console.error('contract-match-api failed:', response.statusCode, response.body);
  process.exit(1);
}
console.log(`Contract match API passed (${response.body.route}, ${response.body.candidates.length} candidate(s)).`);
