#!/usr/bin/env node
// Configuration that is written and read by nothing, removed.
//
// The last of Workstream A3. Four pieces of debris, all of the same kind — a
// value that looks maintained and drives nothing:
//
//  1. `sla_targets` STAGE ROWS. Nine of them, one per lifecycle stage, and they
//     disagreed with the workflow templates in six of the nine: sourcing 10 vs
//     20, contracting 15 vs 10, receipt 3 vs 5, invoice 3 vs 5, payment 2 vs 3,
//     intake 2 vs 1. Nothing read them — `src/lib/db/sla-targets.ts` and its
//     hook had zero importers repo-wide, and every countdown reads
//     `requests.sla_deadline`, computed from the template node's `slaDays`. The
//     table's `stage = 'ticket'` rows ARE live (tickets-core.ts reads them for
//     first-response targets) and are left exactly alone.
//
//  2. `routing_rules.match_count`. Seeded 187, 62, 35, 42… and incremented by
//     nothing. The evaluator is pure and takes no persistence handle. RR-001
//     carried 42 while all three of its conditions were false — the number
//     implied a history of matches for a rule that had never fired, which is
//     how it went unnoticed for months.
//
//  3. `requests.workflow_template_id` NULL for 114 of 136 requests. The
//     template is what defines a request's stages, owner roles and SLAs, so a
//     request without one has no lifecycle definition — and the intake writer's
//     old fallback of the literal `'WF-001'` would have given a catalogue order
//     the procurement-led workflow, which is worse than none. Each request is
//     assigned the template that CLAIMS ITS CHANNEL, the same rule the stage
//     map and the intake writer use, so all three answer alike.
//
//  4. A request whose `sla_deadline` belongs to a stage it has left. Not
//     written here — `api/workflow-action.ts` now recomputes it on every stage
//     change — but the rows already in that state are corrected, from the same
//     template node, so the countdown matches the stage the request is in.
//
// Idempotent: a second run reports nothing to change.
//
//   npm run backfill:c10-debris   (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';
import { templateForChannel } from '../../src/lib/workflow/channel-stages.ts';
import { nodeIdForStatus } from '../../src/lib/workflow/node-config.ts';
import { slaDeadlineFor } from '../../src/lib/workflow/business-days.ts';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('C10 debris'));

// ── 1. The sla_targets stage rows ──────────────────────────────────────────
const staleTargets = await sql`SELECT stage, channel, days FROM sla_targets WHERE stage <> 'ticket'`;
if (staleTargets.length === 0) {
  console.log('= sla_targets holds only ticket rows');
} else {
  console.log(`- ${staleTargets.length} sla_targets stage row(s): ${staleTargets.map((r) => `${r.stage}=${r.days}d`).join(', ')}`);
  if (!DRY) await sql`DELETE FROM sla_targets WHERE stage <> 'ticket'`;
}

// ── 2. routing_rules.match_count ───────────────────────────────────────────
const hasMatchCount = await sql`
  SELECT 1 FROM information_schema.columns
   WHERE table_name = 'routing_rules' AND column_name = 'match_count'`;
if (hasMatchCount.length === 0) {
  console.log('= routing_rules.match_count is already gone');
} else {
  const total = await sql`SELECT COALESCE(SUM(match_count), 0)::int AS n FROM routing_rules`;
  console.log(`- routing_rules.match_count (${total[0].n} phantom matches across all rules)`);
  // Not a tagged template: Neon's `sql` binds `${}` as a PARAMETER, and a
  // parameter cannot stand where an identifier does. This statement takes no
  // user input, so there is nothing to bind.
  if (!DRY) await sql.query('ALTER TABLE routing_rules DROP COLUMN IF EXISTS match_count');
}

// ── 3 & 4. workflow_template_id and a stale sla_deadline ───────────────────
const templates = await sql`SELECT id, channels, nodes FROM workflow_templates ORDER BY id`;
const nodesOf = (id) => {
  const nodes = templates.find((t) => t.id === id)?.nodes;
  return Array.isArray(nodes) ? nodes : [];
};

// `stage_entered_at` is the open stage_history row — when the current stage
// actually opened. Measuring from `now` instead would hand a request that has
// been sitting for a week a fresh clock and quietly un-flag it.
//
// Every timestamp read as TEXT. These columns are `timestamp`, not
// `timestamptz`, so the driver rebuilds them in the reading client's local zone
// and hands back instants shifted by that offset — then this script would write
// the shifted value back, moving every deadline by an hour per run and never
// converging. Comparing and computing in the stored wall-clock keeps it
// idempotent. (The naive-timestamp columns are a real defect, 33 of them across
// 20 tables, and a separate piece of work.)
const requests = await sql`
  SELECT r.id, r.status, r.buying_channel, r.workflow_template_id,
         r.sla_deadline::text AS sla_deadline, r.created_at::text AS created_at,
         (SELECT sh.entered_at::text FROM stage_history sh
           WHERE sh.request_id = r.id AND sh.completed_at IS NULL
           ORDER BY sh.entered_at DESC LIMIT 1) AS stage_entered_at
    FROM requests r ORDER BY r.id`;

/** A stored naive timestamp, read as the UTC instant it was written as. */
const storedInstant = (text) => (text ? new Date(`${text.replace(' ', 'T')}Z`) : null);

let assigned = 0;
let unclaimed = 0;
const byTemplate = new Map();

for (const request of requests) {
  if (request.workflow_template_id) continue;
  const templateId = templateForChannel(templates, request.buying_channel);
  if (!templateId) {
    // Left NULL and reported. No template claims this channel, so there is no
    // honest answer — writing any id here would state a lifecycle the platform
    // cannot run. `unclaimedChannels` is the surface that already says so.
    console.log(`  ! ${request.id}: channel "${request.buying_channel}" has no template`);
    unclaimed += 1;
    continue;
  }
  byTemplate.set(templateId, (byTemplate.get(templateId) ?? 0) + 1);
  assigned += 1;
  if (DRY) continue;
  await sql`UPDATE requests SET workflow_template_id = ${templateId} WHERE id = ${request.id}`;
}

if (assigned === 0 && unclaimed === 0) console.log('= every request names a workflow template');
else {
  console.log(`  ${DRY ? 'would assign' : 'assigned'} ${assigned} request(s):`);
  for (const [id, n] of [...byTemplate.entries()].sort()) console.log(`      ${id}: ${n}`);
  if (unclaimed > 0) console.log(`  ${unclaimed} left NULL — no template claims their channel`);
}

// A deadline computed against the wrong template.
//
// `backfill:sla-deadlines` dated these requests when 114 of them had no
// template, and fell back to the literal `'WF-001'` — so a catalogue order
// carrying WF-001's 5-day approval instead of WF-002's 3-day one, for every
// stage. Now that each request names the template that claims its channel, the
// deadline is recomputed from that template's node for the stage the request is
// actually in. A stage whose node sets no SLA gets NULL: carrying a deadline
// the current stage did not set is precisely the defect this commit closes.
//
// Terminal and pre-submission statuses are left alone entirely — a completed
// request is not late and a draft has not started, and nothing writes them.
const NO_CLOCK = new Set(['completed', 'cancelled', 'draft']);
let corrected = 0;
for (const request of requests) {
  if (NO_CLOCK.has(request.status)) continue;
  const templateId = request.workflow_template_id
    ?? templateForChannel(templates, request.buying_channel);
  if (!templateId) continue;

  const nodes = nodesOf(templateId);
  const nodeId = nodeIdForStatus(nodes, request.status);
  const slaDays = nodes.find((n) => n.id === nodeId)?.slaDays;
  const from = storedInstant(request.stage_entered_at ?? request.created_at);
  if (!from) continue;
  const want = slaDeadlineFor(from, slaDays);

  const have = storedInstant(request.sla_deadline)?.toISOString() ?? null;
  // Compare the computed value against the stored one, so a re-run over an
  // already-corrected store changes nothing.
  if (have === want) continue;
  corrected += 1;
  if (corrected <= 10) console.log(`  ~ ${request.id} (${request.status}, ${templateId}): ${have ?? 'none'} → ${want ?? 'none'}`);
  if (DRY) continue;
  await sql`UPDATE requests SET sla_deadline = ${want} WHERE id = ${request.id}`;
}
if (corrected > 10) console.log(`  … and ${corrected - 10} more`);
console.log(corrected === 0
  ? '= every deadline belongs to the stage its request is in'
  : `  ${DRY ? 'would correct' : 'corrected'} ${corrected} deadline(s)`);
