#!/usr/bin/env node
// Give every buying channel a workflow template, and correct the catalogue one.
//
// The lifecycle was defined twice — `buying-channel-stages.ts` in code, the
// template graph in data — and they disagreed for every channel. Templates are
// going to win, because a template is the thing an admin can see and change.
// But flipping the source before the data is right would propagate the wrong
// lifecycle into live requests, so this fixes the data first.
//
// Three things:
//
//  1. WF-002's "Auto-Validate" normalises to `validation`, a stage the
//     catalogue channel skips — so every catalogue request showed a phantom
//     stage while lacking the `intake` it actually has. It IS the automated
//     intake check; renaming it to "Intake" removes the phantom and supplies
//     the missing stage. Invoice and Payment are appended: a catalogue order
//     is still invoiced and paid, and the template stopped at Receipt.
//
//  2. WF-005, WF-006 and WF-007 are created for direct-po, business-led +
//     framework-call-off, and p-card — four channels that had no template at
//     all, which is why deriving the map was impossible for most of them.
//     Stages, roles and SLAs are WF-001's, so nothing changes behaviour.
//
//  3. `channels` is set on all seven. Empty for WF-003 and WF-004: they are
//     workflows for different objects (supplier onboarding, contract renewal),
//     selected by category, and no request has ever used either.
//
// Idempotent: a template already carrying the right channels and graph is
// left alone, so a re-run reports and changes nothing.
//
//   npm run backfill:template-channels   (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';
import { workflowTemplates } from '../../src/data/workflows.ts';
import { stagesFromTemplate, channelStageMapFromTemplates, unclaimedChannels } from '../../src/lib/workflow/channel-stages.ts';
import { BUYING_CHANNELS, getStagesForChannel } from '../../src/lib/workflow/buying-channel-stages.ts';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('template channels'));

// Refuse to write a set that disagrees with the code map. This backfill exists
// to make the two agree; writing templates that do not would defeat it.
const seedMap = channelStageMapFromTemplates(workflowTemplates);
const mismatched = BUYING_CHANNELS.filter(
  (c) => (seedMap[c] ?? []).join('>') !== [...getStagesForChannel(c)].join('>'),
);
if (mismatched.length > 0) {
  console.error('The seed templates do not reproduce the code map for:', mismatched.join(', '));
  console.error('Fix src/data/workflows.ts before running this.');
  process.exit(1);
}
const seedUnclaimed = unclaimedChannels(seedMap, BUYING_CHANNELS);
if (seedUnclaimed.length > 0) {
  console.error('Channels with no template in the seed:', seedUnclaimed.join(', '));
  process.exit(1);
}

const existing = await sql`SELECT id, name, channels, nodes, edges FROM workflow_templates`;
const byId = new Map(existing.map((r) => [r.id, r]));
let changed = 0;

// Compared field by field, not by JSON.stringify: Postgres returns jsonb keys
// in its own order, so a raw string compare reports every template as changed
// and the backfill never looks idempotent.
const nodeKey = (n) => [
  n.id, n.type, n.label, n.role ?? '', n.slaDays ?? '', n.gate ?? '', n.purpose ?? '', n.x ?? '', n.y ?? '',
].join('|');
const sameNodes = (a, b) => (a ?? []).map(nodeKey).sort().join(' ') === (b ?? []).map(nodeKey).sort().join(' ');

// Edge order matters only WITHIN one source: getNextNodeIds evaluates a node's
// outgoing edges in declaration order. The order of the array as a whole does
// not — live appends new edges at the end while the seed keeps them in graph
// order, and those are the same workflow. Same rule test:seed-parity applies.
const edgesBySource = (edges) => {
  const grouped = new Map();
  for (const e of edges ?? []) {
    if (!grouped.has(e.source)) grouped.set(e.source, []);
    grouped.get(e.source).push(`${e.target}[${e.label ?? ''}]`);
  }
  return [...grouped.entries()].sort().map(([src, outs]) => `${src}:${outs.join(',')}`).join(' ');
};
const sameEdges = (a, b) => edgesBySource(a) === edgesBySource(b);
const sameChannels = (a, b) => [...(a ?? [])].sort().join(',') === [...(b ?? [])].sort().join(',');

for (const template of workflowTemplates) {
  const row = byId.get(template.id);
  const channels = template.channels ?? [];

  if (!row) {
    console.log(`+ ${template.id} "${template.name}" → ${channels.join(', ') || '(no channel)'}`);
    console.log(`      ${stagesFromTemplate(template).join(' > ') || '(no stages)'}`);
    changed += 1;
    if (DRY) continue;
    await sql`
      INSERT INTO workflow_templates (id, name, description, type, channels, nodes, edges)
      VALUES (${template.id}, ${template.name}, ${template.description}, ${template.type},
              ${channels}, ${JSON.stringify(template.nodes)}::jsonb, ${JSON.stringify(template.edges)}::jsonb)`;
    continue;
  }

  const graphChanged = !sameNodes(row.nodes, template.nodes) || !sameEdges(row.edges, template.edges);
  const channelsChanged = !sameChannels(row.channels, channels);
  if (!graphChanged && !channelsChanged) {
    console.log(`= ${template.id} already matches`);
    continue;
  }
  if (channelsChanged) {
    console.log(`  ${template.id}: channels [${(row.channels ?? []).join(', ')}] → [${channels.join(', ')}]`);
  }
  if (graphChanged) {
    const before = stagesFromTemplate({ ...template, nodes: row.nodes, edges: row.edges });
    console.log(`  ${template.id}: ${before.join(' > ') || '(none)'}`);
    console.log(`      → ${stagesFromTemplate(template).join(' > ') || '(none)'}`);
  }
  changed += 1;
  if (DRY) continue;
  await sql`
    UPDATE workflow_templates
       SET name = ${template.name}, description = ${template.description}, type = ${template.type},
           channels = ${channels},
           nodes = ${JSON.stringify(template.nodes)}::jsonb, edges = ${JSON.stringify(template.edges)}::jsonb
     WHERE id = ${template.id}`;
}

console.log(`\n${DRY ? 'would change' : 'changed'} ${changed} template(s)`);
