#!/usr/bin/env node
// Move requests out of a stage their buying channel does not traverse.
//
// `validation` became procurement-led-only on 2026-09-12: it is the category
// manager's check that demand is complete and correctly routed, which only has
// an answer when the demand is going to market. A catalogue item and a framework
// contract carry that categorisation already.
//
// But api/_domains/intake-submit.ts still wrote a constant `validation` for every
// channel, so business-led and direct-po requests sat in a stage their own
// channel skips — the stepper drew them as skipped while the request was in
// them. The writer now derives the stage from the channel
// (`firstActionableStage`); this repairs the rows written before it did.
//
// The move is not just a status update. All three affected requests have **zero
// approval entries**, so writing `approval` onto them and stopping would strand
// them exactly as the validation gate did — a request in the approval stage with
// nobody able to approve. Approvers are derived through the same
// `deriveApprovalsFor` every other path uses, so these rows are indistinguishable
// from a request submitted today.
//
//   npm run backfill:initial-stage   (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail, neonClient } from '../../tests/lib/live.mjs';
import { firstActionableStage } from '../../src/lib/workflow/buying-channel-stages.ts';
import { nodeIdForStatus } from '../../src/lib/workflow/node-config.ts';
import { approvalRows, deriveApprovalsFor, resolveChainId } from '../../src/lib/db/approvals-core.ts';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('channel initial stage'));
const client = await neonClient('channel-initial-stage');

// Every request sitting in a stage its channel does not traverse.
const stranded = await sql`
  SELECT id, status, buying_channel, category, cost_centre, contract_id, value,
         risk_assessment_required, owner_id, requestor_id, approval_chain
  FROM requests
  WHERE status NOT IN ('draft', 'completed', 'cancelled', 'referred-back')
  ORDER BY id
`;

const moves = [];
for (const row of stranded) {
  const target = firstActionableStage(row.buying_channel, {
    riskAssessmentRequired: Boolean(row.risk_assessment_required),
  });
  // Only the stage the writer would choose *at intake* is repaired here. A
  // request legitimately further along (po, receipt, invoice) must not be
  // dragged backwards, so only rows still in the old constant are candidates.
  if (row.status !== 'validation' || target === 'validation') continue;
  moves.push({ row, target });
}

if (moves.length === 0) {
  console.log('No request is in a stage its channel skips.');
  process.exit(0);
}

console.log(`${moves.length} request(s) in a stage their channel does not traverse:\n`);
for (const { row, target } of moves) {
  console.log(`  ${row.id}  ${row.buying_channel.padEnd(16)} validation → ${target}`);
}

if (DRY) {
  console.log('\nDry run — nothing was changed.');
  process.exit(0);
}

const now = new Date().toISOString();
let repaired = 0;

for (const { row, target } of moves) {
  const queries = [];

  // Approvers first: a request entering `approval` with none is the defect this
  // backfill exists to avoid re-creating.
  let approvalCount = 0;
  if (target === 'approval') {
    const existing = await sql`SELECT count(*)::int AS count FROM approval_entries WHERE request_id = ${row.id}`;
    if (existing[0].count === 0) {
      const chainId = await resolveChainId(client, row.approval_chain ?? null, Number(row.value ?? 0));
      const derived = await deriveApprovalsFor(client, {
        requestId: row.id,
        category: row.category,
        costCentre: row.cost_centre ?? null,
        contractId: row.contract_id ?? null,
      }, chainId);
      for (const entry of approvalRows(row.id, derived, now)) {
        const columns = Object.keys(entry);
        queries.push(sql.query(
          `INSERT INTO approval_entries (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`,
          Object.values(entry),
        ));
        approvalCount += 1;
      }
    }
  }

  // Close the open row before opening its replacement — the request must never
  // have two open stages (UNIQUE (request_id, stage, entered_at) and the
  // steppers both read "which stage is open").
  queries.push(sql.query(
    'UPDATE stage_history SET completed_at = $1 WHERE request_id = $2 AND completed_at IS NULL',
    [now, row.id],
  ));
  queries.push(sql.query(
    `INSERT INTO stage_history (request_id, stage, entered_at, owner_id, action, notes)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [row.id, target, now, row.owner_id ?? row.requestor_id, 'stage-corrected',
     `Channel ${row.buying_channel} does not traverse validation; moved to its first actionable stage.`],
  ));
  queries.push(sql.query(
    'UPDATE requests SET status = $1, updated_at = $2, days_in_stage = 0 WHERE id = $3',
    [target, now, row.id],
  ));

  // Point any workflow instance at the node for the new stage, so the engine can
  // resume. An instance stuck on the old validation node is why this matters.
  const [instance] = await sql`SELECT id, template_id FROM workflow_instances WHERE request_id = ${row.id}`;
  if (instance) {
    const [tpl] = await sql`SELECT nodes FROM workflow_templates WHERE id = ${instance.template_id}`;
    const nodeId = nodeIdForStatus(Array.isArray(tpl?.nodes) ? tpl.nodes : [], target);
    if (nodeId) {
      queries.push(sql.query(
        'UPDATE workflow_instances SET current_node_ids = $1, updated_at = $2 WHERE id = $3',
        [JSON.stringify([nodeId]), now, instance.id],
      ));
    } else {
      console.warn(`    ${row.id}: ${instance.template_id} has no '${target}' node; instance left as-is.`);
    }
  }

  await sql.transaction(queries);
  repaired += 1;
  console.log(`  ${row.id} → ${target}${approvalCount ? ` (${approvalCount} approver(s) derived)` : ''}`);
}

// Verify rather than trust.
const left = await sql`
  SELECT id, status, buying_channel FROM requests
  WHERE status = 'validation' AND buying_channel IS NOT NULL AND buying_channel <> 'procurement-led'
`;
if (left.length > 0) {
  console.error(`\nFAILED: ${left.length} request(s) still in validation on a channel that skips it.`);
  process.exit(1);
}
console.log(`\n${repaired} request(s) repaired. No request is in a stage its channel skips.`);
