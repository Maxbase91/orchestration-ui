#!/usr/bin/env node
// The templates and the code map agree, before the code map is deleted.
//
// The lifecycle is defined twice: `buying-channel-stages.ts` says which stages
// a channel visits, in code, and the workflow templates define the graph the
// engine walks, in data. They disagreed for every channel — WF-002 carried a
// `validation` stage catalogue skips and lacked intake, invoice and payment,
// and four channels had no template at all.
//
// Templates win, because a template is the thing an admin can see and change.
// But flipping the source before the templates are right would propagate the
// wrong lifecycle into live requests, so this commit corrects the data and
// proves equivalence while the CODE MAP IS STILL AUTHORITATIVE. Nothing at
// runtime reads the derivation yet. C8 flips it, and this test inverts.
import { neon } from '@neondatabase/serverless';
import { loadEnv } from '../lib/live.mjs';
import {
  channelStageMapFromTemplates, stagesFromTemplate, unclaimedChannels,
  contestedChannels, lifecycleStagesFrom,
} from '../../src/lib/workflow/channel-stages.ts';
import {
  BUYING_CHANNELS, getStagesForChannel, lifecycleStages,
} from '../../src/lib/workflow/buying-channel-stages.ts';
import { workflowTemplates } from '../../src/data/workflows.ts';

let failures = 0;
const ok = (l) => console.log(`  \x1b[32m✓\x1b[0m ${l}`);
const bad = (l, d) => { failures += 1; console.error(`  \x1b[31m✗\x1b[0m ${l}`); if (d) console.error(`      ${d}`); };

function comparePaths(label, templates) {
  const map = channelStageMapFromTemplates(templates);
  for (const channel of BUYING_CHANNELS) {
    const fromCode = [...getStagesForChannel(channel)];
    const fromData = [...(map[channel] ?? [])];
    if (fromData.length === 0) {
      bad(`${label}: ${channel} is claimed by a template`, 'no template claims it, so it has no lifecycle');
      continue;
    }
    if (fromCode.join(' > ') !== fromData.join(' > ')) {
      bad(`${label}: ${channel} matches the code map`,
        `code  ${fromCode.join(' > ')}\n      data  ${fromData.join(' > ')}`);
    }
  }
  return map;
}

// ── The seed ───────────────────────────────────────────────────────────────
console.log('\nEvery channel derives the lifecycle the code map claims (seed)');
const seedMap = comparePaths('seed', workflowTemplates);
if (failures === 0) ok(`all ${BUYING_CHANNELS.length} channels agree, stage for stage and in order`);

const unclaimed = unclaimedChannels(seedMap, BUYING_CHANNELS);
if (unclaimed.length) bad('no channel is left without a template', unclaimed.join(', '));
else ok('no channel is left without a template');

const contested = contestedChannels(workflowTemplates);
if (contested.length) {
  bad('no channel is claimed by two templates',
    `${contested.join(', ')} — the first claim silently wins, which is the drift being removed`);
} else ok('no channel is claimed twice');

// ── Side processes stay side processes ─────────────────────────────────────
console.log('\nA side process claims no channel');
for (const id of ['WF-003', 'WF-004']) {
  const t = workflowTemplates.find((w) => w.id === id);
  if (!t) { bad(`${id} exists`, 'renamed or removed'); continue; }
  if ((t.channels ?? []).length !== 0) {
    bad(`${id} claims no channel`,
      `"${t.name}" is a workflow for a different object, selected by category — claiming a channel would give that channel the wrong lifecycle`);
  } else ok(`${id} "${t.name}" claims no channel`);
}

// ── Traversal follows edges, not authoring order ───────────────────────────
console.log('\nStages come from the graph, not the nodes array');
const wf001 = workflowTemplates.find((t) => t.id === 'WF-001');
const arrayOrder = wf001.nodes.filter((n) => n.type === 'stage').map((n) => n.label);
const graphOrder = stagesFromTemplate(wf001);
// WF-001 lists Risk Assessment third in the array; the graph reaches it after
// Validation. If the derivation read the array it would report risk too early.
if (arrayOrder[2] !== 'Risk Assessment') {
  console.log(`      (note: WF-001's array order changed — third stage node is now "${arrayOrder[2]}")`);
}
if (graphOrder[1] !== 'validation' || graphOrder[2] !== 'risk') {
  bad('WF-001 reaches validation before risk', graphOrder.join(' > '));
} else ok('WF-001 derives intake > validation > risk, following the edges');

// A cycle must not hang or repeat: referred-back points back at intake.
const cyclic = stagesFromTemplate({
  id: 'C', channels: ['x'],
  nodes: [
    { id: 'a', type: 'start', label: 'Start' },
    { id: 'b', type: 'stage', label: 'Intake' },
    { id: 'c', type: 'error', label: 'Referred Back' },
  ],
  edges: [{ source: 'a', target: 'b' }, { source: 'b', target: 'c' }, { source: 'c', target: 'b' }],
});
if (cyclic.join(',') !== 'intake') bad('a cycle terminates and lists each stage once', cyclic.join(','));
else ok('a cycle terminates and lists each stage once');

// Two nodes normalising to one stage list it once — WF-002 has Auto-PO and
// PO Created, both `po`.
const wf002 = stagesFromTemplate(workflowTemplates.find((t) => t.id === 'WF-002'));
if (wf002.filter((s) => s === 'po').length !== 1) bad('WF-002 lists `po` once', wf002.join(' > '));
else ok('two nodes normalising to one stage list it once');

// ── WF-002 is corrected ────────────────────────────────────────────────────
console.log('\nWF-002 describes the catalogue lifecycle');
if (wf002.includes('validation')) {
  bad('catalogue no longer carries a phantom validation stage',
    '"Auto-Validate" normalised to `validation`, a stage the channel skips');
} else ok('catalogue no longer carries a phantom validation stage');
for (const stage of ['intake', 'invoice', 'payment']) {
  if (!wf002.includes(stage)) bad(`catalogue reaches ${stage}`, wf002.join(' > '));
}
if (failures === 0) ok('catalogue reaches intake, invoice and payment');

// ── The lifecycle union ────────────────────────────────────────────────────
console.log('\nThe derived lifecycle union matches the code one');
const derivedUnion = lifecycleStagesFrom(seedMap);
const codeUnion = lifecycleStages();
if (derivedUnion.join(' > ') !== codeUnion.join(' > ')) {
  bad('lifecycleStagesFrom equals lifecycleStages',
    `code  ${codeUnion.join(' > ')}\n      data  ${derivedUnion.join(' > ')}`);
} else ok(`both give ${derivedUnion.length} stages in the same order`);

// ── Live ───────────────────────────────────────────────────────────────────
const env = loadEnv();
const connection = env.NEON_DATABASE_URL || env.DATABASE_URL;
if (!connection) {
  console.log('\n  (skipped live checks — no database connection)');
} else {
  console.log('\nThe live templates derive the same map');
  const sql = neon(connection);
  const rows = await sql`SELECT id, name, channels, nodes, edges FROM workflow_templates ORDER BY id`;
  const live = rows.map((r) => ({ id: r.id, channels: r.channels ?? [], nodes: r.nodes, edges: r.edges }));
  comparePaths('live', live);
  const liveMap = channelStageMapFromTemplates(live);
  const liveUnclaimed = unclaimedChannels(liveMap, BUYING_CHANNELS);
  if (liveUnclaimed.length) bad('no live channel is unclaimed', liveUnclaimed.join(', '));
  else ok(`all ${BUYING_CHANNELS.length} channels claimed live, deriving the same stages`);

  // Nothing may be sitting in a stage its own channel does not traverse.
  // `draft` is pre-lifecycle — the request has not been submitted, so no
  // channel traverses it. `referred-back` is an error node, and completed and
  // cancelled are terminal. None of the four is a stage a channel visits.
  // Harness records (UI-E2E-, E2E-TEST-) are created and deleted inside one
  // browser pass, so reading while one is in flight fails on residue rather
  // than on configuration. Same exclusion as test:config-consumption.
  const requests = await sql`
    SELECT buying_channel, status, count(*)::int AS n
      FROM requests
     WHERE status NOT IN ('draft', 'completed', 'cancelled', 'referred-back')
       AND buying_channel IS NOT NULL
       AND id NOT LIKE 'UI-E2E-%'
       AND id NOT LIKE 'E2E-TEST-%'
     GROUP BY 1, 2`;
  const stranded = requests.filter((r) => {
    const path = liveMap[r.buying_channel];
    return path && !path.includes(r.status);
  });
  if (stranded.length) {
    bad('no open request sits in a stage its channel skips',
      stranded.map((r) => `${r.n}× ${r.buying_channel} in ${r.status}`).join(', '));
  } else ok('no open request sits in a stage its channel skips');
}

console.log(failures === 0 ? '\n\x1b[32mchannel-map-parity passed\x1b[0m' : `\n\x1b[31m${failures} failed\x1b[0m`);
process.exit(failures === 0 ? 0 : 1);
