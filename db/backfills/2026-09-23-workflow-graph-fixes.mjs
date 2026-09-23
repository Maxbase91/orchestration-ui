#!/usr/bin/env node
// The workflow graphs, corrected in the live store — and the requests that were
// running on the wrong one moved to the right one.
//
// What was wrong (see src/data/workflows.ts for each fix in place):
//
//  1. WF-001 never reached Sourcing on the engine path. An "Auto-Route"
//     decision offered "Needs Approval" / "Direct to Sourcing" — captions, not
//     conditions — so the engine always took Approval, and Approval led to
//     Contracting. Three live requests went approval → contracting.
//  2. Approval stages with no "Rejected" branch (WF-002, WF-003, WF-004): a
//     rejection fell through to the approved path.
//  3. WF-003's "Parallel Checks" sent three branches out of one node; the
//     engine follows one, so two of the checks could never run.
//  4. Contract call-offs shared WF-006 (business-led), which runs vendor
//     onboarding. WF-008 now carries the framework-call-off channel.
//
// And the requests: a business-led request and two call-offs had workflow
// instances on WF-001 — after fix 1 an approval there would send them to
// Sourcing — and one instance pointed at "validation", a status, not a node.
// Each is moved to the template that claims its channel, at the node for the
// stage it is in.
//
// Seed and live are one set of templates (test:seed-parity), so the templates
// written here are read from the seed rather than restated.
//
// Idempotent: a second run reports nothing to change.
//
//   npm run backfill:workflow-graph-fixes   (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';
import { workflowTemplates } from '../../src/data/workflows.ts';
import { templateForChannel } from '../../src/lib/workflow/channel-stages.ts';
import { nodeIdForStatus } from '../../src/lib/workflow/node-config.ts';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('workflow graph fixes'));
const CHANGED = ['WF-001', 'WF-002', 'WF-003', 'WF-004', 'WF-006', 'WF-008'];
// Postgres stores jsonb with its own key order, so compare canonically —
// otherwise every run reports every template as changed.
const canonical = (v) => Array.isArray(v) ? v.map(canonical)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])])) : v;
const same = (a, b) => JSON.stringify(canonical(a ?? null)) === JSON.stringify(canonical(b ?? null));

// ── 1. The templates ────────────────────────────────────────────────────────
const live = new Map((await sql`SELECT id, name, description, type, channels, nodes, edges FROM workflow_templates`)
  .map((r) => [r.id, r]));
for (const id of CHANGED) {
  const seed = workflowTemplates.find((t) => t.id === id);
  if (!seed) throw new Error(`${id} is not in the seed`);
  const row = live.get(id);
  const channels = seed.channels ?? [];
  if (row && same(row.nodes, seed.nodes) && same(row.edges, seed.edges)
    && same([...(row.channels ?? [])].sort(), [...channels].sort()) && row.name === seed.name) {
    console.log(`= ${id} already matches the seed`);
    continue;
  }
  console.log(`${row ? '~' : '+'} ${id} ${seed.name}: ${row ? 'graph/channels updated' : 'created'}`);
  if (DRY) continue;
  await sql`
    INSERT INTO workflow_templates (id, name, description, type, channels, nodes, edges)
    VALUES (${id}, ${seed.name}, ${seed.description ?? null}, ${seed.type ?? null},
            ${channels}, ${JSON.stringify(seed.nodes)}::jsonb, ${JSON.stringify(seed.edges)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, description = EXCLUDED.description, type = EXCLUDED.type,
      channels = EXCLUDED.channels, nodes = EXCLUDED.nodes, edges = EXCLUDED.edges`;
}

// Read back what the store now holds, so the moves below use the real graphs.
const templates = DRY
  ? workflowTemplates
  : (await sql`SELECT id, channels, nodes, edges FROM workflow_templates`).map((r) => ({
      id: r.id, channels: r.channels ?? [], nodes: r.nodes ?? [], edges: r.edges ?? [],
    }));
const byId = new Map(templates.map((t) => [t.id, t]));

// ── 2. Requests on a template that does not claim their channel ─────────────
const requests = await sql`
  SELECT r.id, r.status, r.buying_channel, r.workflow_template_id,
         wi.id AS instance_id, wi.template_id AS instance_template, wi.current_node_ids
    FROM requests r LEFT JOIN workflow_instances wi ON wi.request_id = r.id
   WHERE r.buying_channel IS NOT NULL`;
let moved = 0;
for (const r of requests) {
  const want = templateForChannel(templates, r.buying_channel);
  if (!want) continue;
  const template = byId.get(want);
  const nodeIds = new Set((template?.nodes ?? []).map((n) => n.id));
  const current = Array.isArray(r.current_node_ids) ? r.current_node_ids : [];
  const requestWrong = r.workflow_template_id !== want;
  const instanceWrong = r.instance_id && (r.instance_template !== want || current.some((id) => !nodeIds.has(id)));
  if (!requestWrong && !instanceWrong) continue;

  const node = nodeIdForStatus(template.nodes, r.status);
  console.log(`~ ${r.id} (${r.buying_channel}, ${r.status}): ${r.workflow_template_id ?? '—'}${r.instance_id ? ` / instance ${r.instance_template} ${JSON.stringify(current)}` : ''} → ${want}${r.instance_id ? ` ${node ?? '(no node — instance left)'}` : ''}`);
  moved += 1;
  if (DRY) continue;
  if (requestWrong) await sql`UPDATE requests SET workflow_template_id = ${want} WHERE id = ${r.id}`;
  // An instance is only re-pointed to a node that exists: pointing it at
  // nothing is harder to notice than leaving it where it is.
  if (instanceWrong && node) {
    await sql`UPDATE workflow_instances SET template_id = ${want}, current_node_ids = ${JSON.stringify([node])}::jsonb WHERE id = ${r.instance_id}`;
  }
}
if (moved === 0) console.log('= every request runs on the template that claims its channel');

console.log(DRY ? '\n(dry run — nothing written)' : '\nWorkflow graphs and requests are consistent.');
