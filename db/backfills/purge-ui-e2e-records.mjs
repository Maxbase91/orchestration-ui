#!/usr/bin/env node
// Purge the records the UI-only lifecycle harness leaves behind.
//
// ADR-0006 retains `UI-E2E-<timestamp>` records deliberately, so a reviewer can
// trace a complete request → PR → PO → receipt → invoice → payment history after
// a UAT run. What it did not define is when they go away: every run adds another
// full lifecycle to the shared database, and nothing removed them.
//
// Deletes children before parents so foreign keys hold, and reports what it
// would delete unless --apply is passed — a purge that runs by accident is worse
// than records that accumulate.
//
// Usage:
//   node db/backfills/purge-ui-e2e-records.mjs                 # dry run
//   node db/backfills/purge-ui-e2e-records.mjs --apply         # delete
//   node db/backfills/purge-ui-e2e-records.mjs --older-than 7  # keep the last week

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';

const apply = process.argv.includes('--apply');
const olderThanIndex = process.argv.indexOf('--older-than');
const olderThanDays = olderThanIndex === -1 ? 0 : Number(process.argv[olderThanIndex + 1]);

const connectionString = requireConnectionOrFail('purge-ui-e2e-records');
const sql = neon(connectionString, { fetchOptions: { signal: AbortSignal.timeout(30000) } });

const PREFIX = 'UI-E2E-%';
const cutoff = olderThanDays > 0
  ? new Date(Date.now() - olderThanDays * 86_400_000).toISOString()
  : null;

// Children first: a request owns its lines, requisition, PO, invoices and
// history, and the foreign keys are not all ON DELETE CASCADE.
const ORDER = [
  ['request_lines', 'requisition_id IN (SELECT id FROM purchase_requisitions WHERE request_id LIKE $1)'],
  ['purchase_orders', 'request_id LIKE $1'],
  ['purchase_requisitions', 'request_id LIKE $1'],
  ['goods_receipts', 'request_id LIKE $1'],
  ['invoices', 'request_id LIKE $1'],
  ['stage_history', 'request_id LIKE $1'],
  ['workflow_instances', 'request_id LIKE $1'],
  ['workflow_step_details', 'request_id LIKE $1'],
  ['intake_compliance_records', 'request_id LIKE $1'],
  ['service_descriptions', 'request_id LIKE $1'],
  ['comments', 'request_id LIKE $1'],
  ['approval_entries', 'request_id LIKE $1'],
  ['requests', `id LIKE $1${cutoff ? ' AND created_at < $2' : ''}`],
];

let total = 0;
for (const [table, predicate] of ORDER) {
  const params = predicate.includes('$2') ? [PREFIX, cutoff] : [PREFIX];
  try {
    const counted = await sql.query(`SELECT count(*)::int AS count FROM ${table} WHERE ${predicate}`, params);
    const count = Number(counted[0]?.count ?? 0);
    total += count;
    if (count === 0) continue;
    if (apply) {
      await sql.query(`DELETE FROM ${table} WHERE ${predicate}`, params);
      console.log(`  deleted ${count} from ${table}`);
    } else {
      console.log(`  would delete ${count} from ${table}`);
    }
  } catch (error) {
    // An additive table a deployment has not applied yet is not a failure here.
    const message = error instanceof Error ? error.message : String(error);
    if (/does not exist/i.test(message)) { console.log(`  skipped ${table} (not in this schema)`); continue; }
    throw error;
  }
}

console.log(
  total === 0
    ? 'No UI-E2E records found.'
    : apply
      ? `Purged ${total} UI-E2E records.`
      : `${total} UI-E2E records would be purged. Re-run with --apply to delete them.`,
);
