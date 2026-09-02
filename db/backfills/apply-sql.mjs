#!/usr/bin/env node
// Apply a .sql backfill to Neon without needing psql installed.
//
// The Neon HTTP driver has no multi-statement mode, so the file is split on
// statement boundaries and sent one at a time inside a transaction. Every
// backfill here is written to be idempotent (ON CONFLICT DO NOTHING), so a
// re-run is safe and a partial run can simply be repeated.
//
//   node db/backfills/apply-sql.mjs <file.sql>

import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node db/backfills/apply-sql.mjs <file.sql>');
  process.exit(2);
}

const connectionString = requireConnectionOrFail(`apply-sql ${file}`);
const sql = neon(connectionString, { fetchOptions: { signal: AbortSignal.timeout(60000) } });

// Strip comments and the BEGIN/COMMIT wrapper: the driver manages the
// transaction itself via sql.transaction(), and a bare BEGIN would be rejected.
const statements = readFileSync(file, 'utf8')
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter((statement) => statement && !/^(BEGIN|COMMIT)$/i.test(statement));

if (statements.length === 0) {
  console.log('Nothing to apply.');
  process.exit(0);
}

await sql.transaction(statements.map((statement) => sql.query(statement)));
console.log(`Applied ${statements.length} statement(s) from ${file}.`);
