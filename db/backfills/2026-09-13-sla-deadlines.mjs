#!/usr/bin/env node
// Give every open request the SLA deadline its stage implies.
//
// `sla_deadline` was written only by transitionStage(), so a request got one on
// its first stage *change* and never at creation. 130 of 136 requests in the
// live store had none — which meant no countdown on the header, nothing for the
// Stuck and bottleneck views to measure, and no way for a request to be overdue.
//
// That mattered more than it looked, because `is_overdue` is a stored column
// written false at creation and false on every transition, with nothing that
// ever sets it true. Both the Workflows table and the AI Insights widget read
// it, so they reported zero overdue permanently. `isOverdue` is derived from
// `sla_deadline` now (src/lib/db/mappers.ts), which only works if the deadline
// is actually there.
//
// The deadline comes from the workflow template node for the stage the request
// is in — the template owns stage SLAs — measured from when that stage opened,
// which is the open stage_history row's entered_at.
//
//   npm run backfill:sla-deadlines   (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';
import { nodeIdForStatus } from '../../src/lib/workflow/node-config.ts';
import { templateForChannel } from '../../src/lib/workflow/channel-stages.ts';
import { slaDeadlineFor } from '../../src/lib/workflow/business-days.ts';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('sla deadlines'));

const templates = await sql`SELECT id, channels, nodes FROM workflow_templates`;
const nodesById = new Map(templates.map((t) => [t.id, Array.isArray(t.nodes) ? t.nodes : []]));

// Open requests with no deadline. A closed request needs none, and one that
// already has a deadline keeps it — this repairs the gap, it does not re-time
// anything that is already running to a clock.
const rows = await sql`
  SELECT r.id, r.status, r.workflow_template_id, r.buying_channel,
         (SELECT sh.entered_at FROM stage_history sh
           WHERE sh.request_id = r.id AND sh.completed_at IS NULL
           ORDER BY sh.entered_at DESC LIMIT 1) AS stage_entered_at,
         r.created_at
  FROM requests r
  WHERE r.sla_deadline IS NULL
    AND r.status NOT IN ('draft', 'completed', 'cancelled')
  ORDER BY r.id
`;

const planned = [];
const skipped = [];
for (const row of rows) {
  // The template that claims the request's channel, not a literal 'WF-001'.
  // That fallback dated a catalogue order against the procurement-led
  // workflow's stage SLAs — the right shape of number, from the wrong process.
  const templateId = row.workflow_template_id ?? templateForChannel(templates, row.buying_channel);
  if (!templateId) {
    skipped.push({ id: row.id, why: `no template claims channel '${row.buying_channel}'` });
    continue;
  }
  const nodes = nodesById.get(templateId) ?? [];
  const nodeId = nodeIdForStatus(nodes, row.status);
  const slaDays = nodes.find((n) => n.id === nodeId)?.slaDays;
  if (slaDays == null) {
    skipped.push({ id: row.id, why: `${templateId} has no SLA for '${row.status}'` });
    continue;
  }
  // Measured from when the stage opened, not from now — a request that has been
  // sitting for a week should come out of this already overdue, not given a
  // fresh clock.
  const from = new Date(row.stage_entered_at ?? row.created_at);
  planned.push({ id: row.id, status: row.status, deadline: slaDeadlineFor(from, slaDays) });
}

const now = Date.now();
const alreadyLate = planned.filter((p) => new Date(p.deadline).getTime() <= now).length;
console.log(`${rows.length} open request(s) without a deadline.`);
console.log(`  ${planned.length} can be dated — ${alreadyLate} are already past it.`);
if (skipped.length > 0) {
  console.log(`  ${skipped.length} skipped (no SLA on the template node):`);
  for (const s of skipped.slice(0, 6)) console.log(`    ${s.id} — ${s.why}`);
}

if (DRY) {
  for (const p of planned.slice(0, 10)) console.log(`    ${p.id} ${p.status} → ${p.deadline}`);
  console.log('\nDry run — nothing was changed.');
  process.exit(0);
}

for (const p of planned) {
  await sql`UPDATE requests SET sla_deadline = ${p.deadline} WHERE id = ${p.id}`;
}

const [{ count: remaining }] = await sql`
  SELECT count(*)::int AS count FROM requests
  WHERE sla_deadline IS NULL AND status NOT IN ('draft', 'completed', 'cancelled')
`;
console.log(`\n${planned.length} request(s) dated. ${remaining} open request(s) still without one`
  + `${remaining > 0 ? ' (their template node sets no SLA).' : '.'}`);
