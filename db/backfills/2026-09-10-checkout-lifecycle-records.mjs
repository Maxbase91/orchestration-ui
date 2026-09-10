#!/usr/bin/env node
// Reconstruct the lifecycle records for requests created by governed checkout
// before it wrote them.
//
// A checkout used to write request + requisition + lines + PO and stop, leaving
// no workflow instance, no stage history and no workflow template. Those
// requests have a purchase order but nothing describing where they are or how
// they got there, so the Workflow tab renders placeholders, the Approvals tab
// is empty, and no action can advance them — REQ-2025-9485 is the reported one.
//
// What it reconstructs, and from what:
//   • workflow_template_id — WF-002 for a catalogue route, WF-001 otherwise,
//     read from purchase_requisitions.route (not guessed from the request).
//   • workflow_instances — one running instance on the node matching the stage
//     the request is actually in.
//   • stage_history — intake (entered and completed at the requisition's
//     created_at, because submitting is what completed it) followed by the
//     current stage, left open.
//
// It never invents a timestamp: every row is dated from the requisition the
// checkout wrote, so the reconstructed history agrees with the records that
// survived. A request that already has history or an instance is left alone.
//
//   node --import tsx/esm db/backfills/2026-09-10-checkout-lifecycle-records.mjs
//
// Add --dry-run to report without writing.

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('checkout lifecycle backfill'));

// Which template node corresponds to the stage a request is sitting in. These
// mirror lifecycleEntry() in api/governed-checkout.ts; the seeded templates are
// WF-002 (catalogue) n4 approval / n6 PO, and WF-001 (everything else).
const NODE = {
  'WF-002': { approval: 'n4', po: 'n6', receipt: 'n7', intake: 'n2', validation: 'n2' },
  'WF-001': { approval: 'n5', po: 'n8', risk: 'n14', contracting: 'n7', sourcing: 'n6',
              receipt: 'n9', invoice: 'n10', payment: 'n11', intake: 'n2', validation: 'n3',
              onboarding: 'n15' },
};

const orphans = await sql.query(`
  SELECT r.id, r.status, r.owner_id, r.requestor_id, r.workflow_template_id,
         p.route, p.created_at AS submitted_at
  FROM requests r
  JOIN purchase_requisitions p ON p.request_id = r.id
  WHERE NOT EXISTS (SELECT 1 FROM workflow_instances w WHERE w.request_id = r.id)
  ORDER BY p.created_at`);

if (orphans.length === 0) {
  console.log('No checkout requests are missing their lifecycle records.');
  process.exit(0);
}

console.log(`${orphans.length} request(s) without a workflow instance:\n`);
let written = 0;

for (const row of orphans) {
  const templateId = row.route === 'catalogue' ? 'WF-002' : 'WF-001';
  const stage = String(row.status);
  const nodeId = NODE[templateId][stage];
  const owner = row.owner_id ?? row.requestor_id ?? null;
  const at = new Date(row.submitted_at).toISOString();

  if (!nodeId) {
    console.log(`  ${row.id} — SKIPPED, no ${templateId} node for stage "${stage}"`);
    continue;
  }

  const existing = await sql.query('SELECT stage, completed_at FROM stage_history WHERE request_id = $1', [row.id]);
  console.log(`  ${row.id} · ${row.route} · ${stage} → ${templateId}/${nodeId}` +
    (existing.length ? ` (${existing.length} history row(s) already present)` : ''));
  if (DRY) continue;

  const queries = [
    sql.query('UPDATE requests SET workflow_template_id = COALESCE(workflow_template_id, $1) WHERE id = $2', [templateId, row.id]),
    sql.query(`INSERT INTO workflow_instances (id, request_id, template_id, current_node_ids, status, variables, created_at, updated_at)
               VALUES ($1, $2, $3, $4::jsonb, 'running', $5::jsonb, $6, $6)`,
      [`WI-${row.id}`, row.id, templateId, JSON.stringify([nodeId]),
       JSON.stringify({ route: row.route, reconstructed: true }), at]),
  ];

  // Only add history the request does not already have. Several of these
  // requests carry a partial history from an older client, and overwriting it
  // would replace a real record with a reconstruction.
  if (!existing.some((h) => h.stage === 'intake')) {
    queries.push(sql.query(
      `INSERT INTO stage_history (request_id, stage, entered_at, completed_at, owner_id, action, notes)
       VALUES ($1, 'intake', $2, $2, $3, 'submitted', 'Reconstructed: the checkout that created this request did not write its lifecycle records.')`,
      [row.id, at, owner]));
  }
  if (!existing.some((h) => h.stage === stage)) {
    queries.push(sql.query(
      `INSERT INTO stage_history (request_id, stage, entered_at, owner_id, action, notes)
       VALUES ($1, $2, $3, $4, 'advanced', 'Reconstructed from the requisition this request was created with.')`,
      [row.id, stage, at, owner]));
  }

  await sql.transaction(queries);
  written += 1;
}

console.log(DRY ? '\nDry run — nothing written.' : `\nReconstructed ${written} request(s).`);
