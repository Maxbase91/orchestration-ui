#!/usr/bin/env node
// The workflow templates are the only definition of a channel's lifecycle.
//
// This is test:channel-map-parity inverted. That test existed to prove the
// derivation matched `buying-channel-stages.ts` before the code map was
// deleted; the code map is gone now, so there is nothing to compare against
// and the properties themselves have to be asserted directly.
//
// What the code map used to hide, and what these checks exist to catch:
//
//  - a channel with no template (it always had an answer, so a channel nobody
//    had configured looked configured);
//  - a channel claimed by two templates (the first silently won);
//  - a stage list that disagreed with the graph the engine walks;
//  - an unknown channel falling back to a nine-stage list that omitted `risk`
//    and `onboarding`, so two stages silently vanished.
import { readFileSync, readdirSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { loadEnv } from '../lib/live.mjs';
import {
  BUYING_CHANNELS, channelStageMapFromTemplates, stagesFromTemplate,
  unclaimedChannels, contestedChannels, lifecycleStagesFrom,
  getStagesForChannel, isStageSkippedForChannel, nextStageAfter, firstActionableStage, isSideProcess,
} from '../../src/lib/workflow/channel-stages.ts';
import { LABELLED_STAGE_IDS, stageLabel } from '../../src/lib/workflow/stage-labels.ts';
import { workflowTemplates } from '../../src/data/workflows.ts';

const ROOT = new URL('../../', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, ROOT), 'utf8');
let failures = 0;
const ok = (l) => console.log(`  \x1b[32m✓\x1b[0m ${l}`);
const bad = (l, d) => { failures += 1; console.error(`  \x1b[31m✗\x1b[0m ${l}`); if (d) console.error(`      ${d}`); };

const seedMap = channelStageMapFromTemplates(workflowTemplates);

// ── The code map is really gone ────────────────────────────────────────────
console.log('\nNothing defines a stage list outside a template');
let stale = false;
try { read('src/lib/workflow/buying-channel-stages.ts'); stale = true; } catch { /* deleted */ }
if (stale) bad('buying-channel-stages.ts is deleted', 'a second definition of the lifecycle is back');
else ok('buying-channel-stages.ts is deleted');

// A restated stage list anywhere is the thing this whole commit removes.
for (const file of [
  'src/features/requests/request-detail/components/lifecycle-stepper.tsx',
  'src/features/requests/request-detail/tab-workflow.tsx',
  'src/features/admin/forms/form-builder-page.tsx',
]) {
  const src = read(file);
  if (/const LIFECYCLE_STAGES: \{ id: RequestStatus/.test(src) || /const STAGES = \[\s*'intake'/.test(src)) {
    bad(`${file} derives its stage list`, 'a hand-written list is back');
  }
}
if (failures === 0) ok('no component restates the lifecycle');

// ── Every channel has exactly one template ─────────────────────────────────
console.log('\nEvery channel is claimed by exactly one template');
const unclaimed = unclaimedChannels(seedMap, BUYING_CHANNELS);
if (unclaimed.length) bad('no channel is unclaimed', `${unclaimed.join(', ')} — routing can send a demand somewhere with no lifecycle`);
else ok(`all ${BUYING_CHANNELS.length} channels claimed`);

const contested = contestedChannels(workflowTemplates);
if (contested.length) bad('no channel is claimed twice', `${contested.join(', ')} — the first claim silently wins`);
else ok('no channel is claimed twice');

// ── Each derived path is coherent ──────────────────────────────────────────
console.log('\nEach channel derives a coherent path');
for (const channel of BUYING_CHANNELS) {
  const path = getStagesForChannel(seedMap, channel);
  if (path.length === 0) { bad(`${channel} has stages`, 'empty'); continue; }
  if (path[0] !== 'intake') bad(`${channel} starts at intake`, path.join(' > '));
  if (new Set(path).size !== path.length) bad(`${channel} lists each stage once`, path.join(' > '));
  const unnamed = path.filter((s) => !LABELLED_STAGE_IDS.includes(s));
  if (unnamed.length) bad(`${channel} stages all have display names`, `${unnamed.join(', ')} would render as a raw id`);
}
if (failures === 0) ok(`${BUYING_CHANNELS.length} channels: start at intake, no repeats, every stage nameable`);

// ── The lookups behave ─────────────────────────────────────────────────────
console.log('\nThe lookups agree with the paths they read');
for (const channel of BUYING_CHANNELS) {
  const path = getStagesForChannel(seedMap, channel);
  // Walking with nextStageAfter must reproduce the path and terminate.
  const walked = ['intake'];
  let guard = 0;
  let cursor = 'intake';
  for (;;) {
    const next = nextStageAfter(seedMap, channel, cursor);
    if (!next) break;
    walked.push(next);
    cursor = next;
    if (++guard > 50) { bad(`${channel} terminates`, 'nextStageAfter looped'); break; }
  }
  if (walked.join(' > ') !== path.join(' > ')) {
    bad(`${channel}: walking nextStageAfter reproduces the path`,
      `path   ${path.join(' > ')}\n      walked ${walked.join(' > ')}`);
  }
  // Every stage on the path is not skipped; every stage off it is.
  const offPath = lifecycleStagesFrom(seedMap).filter((s) => !path.includes(s));
  if (path.some((s) => isStageSkippedForChannel(seedMap, channel, s))) bad(`${channel}: no on-path stage reads as skipped`);
  if (offPath.some((s) => !isStageSkippedForChannel(seedMap, channel, s))) bad(`${channel}: every off-path stage reads as skipped`);
  // The landing stage must be one the channel actually traverses — the
  // original defect: a constant `validation` for every channel.
  for (const risk of [false, true]) {
    const landing = firstActionableStage(seedMap, channel, { riskAssessmentRequired: risk });
    if (!path.includes(landing)) {
      bad(`${channel} (risk=${risk}) lands on a traversed stage`, `${landing} is not in ${path.join(' > ')}`);
    }
    if (landing === 'intake') bad(`${channel} does not land back on intake`, 'intake is where it already is');
  }
}
if (failures === 0) ok('nextStageAfter walks each path exactly, skipping is the complement, landing is on-path');

// ── A template with no edges still yields its stages ──────────────────────
// Traversal follows edges, so an edgeless template produced NOTHING and the
// request detail rendered a blank stepper. Array order is the best effort
// available when there is no graph — and must never be used when there is one,
// because that is exactly when it disagrees.
console.log('\nAn edgeless template still yields its stages');
const edgeless = stagesFromTemplate({
  id: 'E', channels: ['x'],
  nodes: [
    { id: 'n1', type: 'start', label: 'Start' },
    { id: 'n2', type: 'stage', label: 'Intake' },
    { id: 'n3', type: 'stage', label: 'Approval' },
  ],
  edges: [],
});
if (edgeless.join(' > ') !== 'intake > approval') {
  bad('an edgeless template falls back to node order', edgeless.join(' > ') || '(nothing)');
} else ok('an edgeless template falls back to node order rather than rendering nothing');

// With edges present, the graph wins even when the array disagrees — the
// fallback must not leak into the normal path.
const disagreeing = stagesFromTemplate({
  id: 'D', channels: ['x'],
  nodes: [
    { id: 'n1', type: 'start', label: 'Start' },
    { id: 'n9', type: 'stage', label: 'Payment' },
    { id: 'n2', type: 'stage', label: 'Intake' },
  ],
  edges: [{ source: 'n1', target: 'n2' }, { source: 'n2', target: 'n9' }],
});
if (disagreeing.join(' > ') !== 'intake > payment') {
  bad('the graph wins over array order when edges exist', disagreeing.join(' > '));
} else ok('the graph wins over array order when edges exist');

// ── An unknown channel gets the union, not a truncated list ────────────────
console.log('\nAn unknown channel degrades to the union');
const union = lifecycleStagesFrom(seedMap);
const unknown = getStagesForChannel(seedMap, 'not-a-channel');
if (unknown.join(' > ') !== union.join(' > ')) {
  bad('an unknown channel gets every stage', unknown.join(' > '));
} else ok(`an unknown channel gets all ${union.length} stages, so the stepper hides none`);
for (const stage of ['risk', 'onboarding']) {
  if (!union.includes(stage)) {
    bad(`the union includes ${stage}`,
      'the old FULL_LIFECYCLE fallback omitted it, so an unknown channel silently lost two stages');
  }
}
if (!union.includes('validation')) bad('the union includes validation');
if (failures === 0) ok('the union includes risk, onboarding and validation');

// ── Labels are defined once ────────────────────────────────────────────────
console.log('\nStage display names live in one place');
if (stageLabel('po') !== 'Purchase Order') bad('po has a stable label', stageLabel('po'));
if (stageLabel('made-up') !== 'made-up') bad('an unknown stage falls back to its id', stageLabel('made-up'));
// Ten copies existed, with FIVE different answers for `po` ("Purchase Order",
// "PO Creation", "PO", …) and most of them missing `risk` and `onboarding`
// entirely, so those stages rendered as raw ids across the monitor, kanban,
// timeline and charts. Scanned across the whole tree rather than a fixed list,
// because a fixed list is how six of them went unnoticed.
const labelCopies = [];
const walk = (dir) => {
  for (const entry of readdirSync(new URL(dir, ROOT), { withFileTypes: true })) {
    const rel = `${dir}${entry.name}`;
    if (entry.isDirectory()) { walk(`${rel}/`); continue; }
    if (!/\.tsx?$/.test(entry.name)) continue;
    if (rel.endsWith('src/lib/workflow/stage-labels.ts')) continue;
    if (/const STAGE_LABELS?(: [^=]*)? = \{/.test(read(rel))) labelCopies.push(rel);
  }
};
walk('src/');
if (labelCopies.length > 0) {
  bad('no module keeps its own stage-label map', labelCopies.join(', '));
} else ok('one stage-label map, used by every surface');

// The map was also doing duty as a stage LIST — `ACTIVE_STAGES =
// Object.keys(STAGE_LABEL)` meant the bottleneck analysis covered six stages of
// eleven and never reported one in receipt, invoice, payment, risk or
// onboarding: the back half, where requests actually pile up.
const analysis = read('src/features/workflows/components/ai-bottleneck-analysis.tsx');
if (/Object\.keys\(STAGE_LABEL/.test(analysis)) {
  bad('no stage list is derived from a label map', 'a label map is not a lifecycle');
} else if (!/lifecycleStagesFrom/.test(analysis)) {
  bad('the bottleneck analysis covers the whole lifecycle', 'it does not derive its stages from the templates');
} else ok('the bottleneck analysis covers every stage the templates define');

// ── Live ───────────────────────────────────────────────────────────────────
const env = loadEnv();
const connection = env.NEON_DATABASE_URL || env.DATABASE_URL;
if (!connection) {
  console.log('\n  (skipped live checks — no database connection)');
} else {
  console.log('\nThe live templates drive the same lifecycle');
  const sql = neon(connection);
  const rows = await sql`SELECT id, channels, nodes, edges FROM workflow_templates ORDER BY id`;
  const liveMap = channelStageMapFromTemplates(
    rows.map((r) => ({ id: r.id, channels: r.channels ?? [], nodes: r.nodes, edges: r.edges })),
  );
  for (const channel of BUYING_CHANNELS) {
    const fromSeed = getStagesForChannel(seedMap, channel).join(' > ');
    const fromLive = getStagesForChannel(liveMap, channel).join(' > ');
    if (fromSeed !== fromLive) {
      bad(`${channel}: live derives what the seed derives`, `seed ${fromSeed}\n      live ${fromLive}`);
    }
  }
  const liveUnclaimed = unclaimedChannels(liveMap, BUYING_CHANNELS);
  if (liveUnclaimed.length) bad('no live channel is unclaimed', liveUnclaimed.join(', '));
  else if (failures === 0) ok(`all ${BUYING_CHANNELS.length} live channels derive the seed's path`);

  // Harness records (UI-E2E-, E2E-TEST-) are created and deleted inside one
  // browser pass, so reading while one is in flight fails on residue.
  const requests = await sql`
    SELECT buying_channel, status, count(*)::int AS n
      FROM requests
     WHERE status NOT IN ('draft', 'completed', 'cancelled', 'referred-back')
       AND buying_channel IS NOT NULL
       AND id NOT LIKE 'UI-E2E-%' AND id NOT LIKE 'E2E-TEST-%'
     GROUP BY 1, 2`;
  const stranded = requests.filter((r) => isStageSkippedForChannel(liveMap, r.buying_channel, r.status));
  if (stranded.length) {
    bad('no open request sits in a stage its channel skips',
      stranded.map((r) => `${r.n}× ${r.buying_channel} in ${r.status}`).join(', '));
  } else {
    const total = requests.reduce((n, r) => n + r.n, 0);
    ok(`${total} open request(s), every one in a stage its channel traverses`);
  }
}


// ── Side processes are not request lifecycles ──────────────────────────────
// WF-003 (Supplier Onboarding) and WF-004 (Contract Renewal) govern a supplier
// and a contract, not a request, and are selected by category rather than by
// buying channel. They sat in the request Workflow Designer beside the five
// channel templates, under a banner reading "This graph is the lifecycle. The
// stages a request visits…" — true of the others and false of these.
console.log('\nSide processes are separated from request lifecycles');
{
  const sideProcesses = workflowTemplates.filter(isSideProcess);
  const lifecycles = workflowTemplates.filter((t) => !isSideProcess(t));

  if (sideProcesses.length !== 2) {
    bad('exactly the two side processes are classed as such',
      sideProcesses.map((t) => t.id).join(', ') || '(none)');
  } else ok(`${sideProcesses.map((t) => t.id).join(' and ')} are side processes`);

  // The functional consequence, not just the label: a side process must claim
  // no buying channel, or it would be deriving some request's stages.
  const claiming = sideProcesses.filter((t) => (t.channels ?? []).length > 0);
  if (claiming.length > 0) {
    bad('a side process claims no buying channel', claiming.map((t) => t.id).join(', '));
  } else ok('no side process claims a buying channel');

  // And the converse: every request lifecycle must claim one, or it is a
  // template that governs nothing and belongs on neither screen.
  const unclaimed = lifecycles.filter((t) => (t.channels ?? []).length === 0);
  if (unclaimed.length > 0) {
    bad('every request lifecycle claims a channel', unclaimed.map((t) => t.id).join(', '));
  } else ok(`all ${lifecycles.length} request lifecycles claim a channel`);

  // The designer is scoped by the same predicate, so the two screens partition
  // the templates rather than overlapping or dropping one.
  const designer = read('src/features/admin/workflow-designer/workflow-designer-page.tsx');
  if (!/\(scope === 'side-process'\) === isSideProcess\(t\)/.test(designer)) {
    bad('the designer filters by the shared predicate',
      'a second copy of the rule is how the two screens drift apart');
  } else ok('the designer filters by the shared predicate');
  if (!/These are side processes, not request lifecycles/.test(designer)) {
    bad('the side-process screen says what it is',
      'the request banner claims the graph decides a request\u2019s stages');
  } else ok('each scope carries its own banner');
  const app = read('src/App.tsx');
  if (!/admin\/workflows\/side-processes/.test(app)) bad('the side-process route exists');
  else ok('the side-process route exists');
}

console.log(failures === 0 ? '\n\x1b[32mchannel-stages passed\x1b[0m' : `\n\x1b[31m${failures} failed\x1b[0m`);
process.exit(failures === 0 ? 0 : 1);
