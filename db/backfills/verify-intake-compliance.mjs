#!/usr/bin/env node
// Did the intake-compliance recovery actually land?
//
// "Applied 39 statement(s)" only says the driver accepted 39 statements. Every
// one of them is ON CONFLICT (request_id) DO NOTHING, so a statement can succeed
// and insert nothing — which is exactly what a re-run should do, and exactly
// what a broken run would look like too. This reads the request_ids back out of
// the committed SQL and asks the database which of them are present.
//
//   node db/backfills/verify-intake-compliance.mjs
//
// Exits 1 when any row is missing, so it can gate the workflow that applies it.

import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';
import { splitStatements } from './split-sql.mjs';

const FILE = new URL('./2026-09-02-intake-compliance-records.sql', import.meta.url);

// The first quoted literal in each INSERT is the request_id; the statement list
// comes from the same splitter the applier uses, so the two cannot disagree
// about how many statements the file holds.
const expected = splitStatements(readFileSync(FILE, 'utf8'))
  .map((statement) => /VALUES\s*\(\s*'([^']+)'/.exec(statement)?.[1])
  .filter(Boolean);

if (expected.length === 0) {
  console.error('No request_ids found in the backfill — the file or the parser changed.');
  process.exit(2);
}

const sql = neon(requireConnectionOrFail('verify-intake-compliance'), {
  fetchOptions: { signal: AbortSignal.timeout(30000) },
});

const rows = await sql.query(
  'SELECT request_id FROM intake_compliance_records WHERE request_id = ANY($1)',
  [expected],
);
const present = new Set(rows.map((row) => String(row.request_id)));
const missing = expected.filter((id) => !present.has(id));

console.log(`Expected ${expected.length} intake-compliance rows; ${present.size} present, ${missing.length} missing.`);
if (missing.length) {
  console.error(`Missing: ${missing.join(', ')}`);
  process.exit(1);
}
console.log('Every request in the recovery file has its compliance record.');
