#!/usr/bin/env node
// A decision node decides, and the designer persists what it collects.
//
// Two failures of the same kind, on the same screen.
//
// EDGES. A branch was a free-text label the engine tried to parse. It handled
// `approved`, `risk required` and `value > 100000`, and returned false for
// everything else — after which `getNextNodeIds` silently took the first
// outgoing edge. WF-002's decision read `> €5K` / `< €5K`, exactly what an
// admin would write, and evaluated to nothing: every catalogue order took the
// Manager Approval branch regardless of value, for as long as the node existed.
//
// NODES. The palette offered ten types and `reverseType` mapped four, so an
// Approval, Timer, AI Agent, Notification, System Action or Sub-workflow node
// saved as a plain stage — the label survived and the node kind did not.
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { loadEnv } from '../lib/live.mjs';
import {
  edgeConditionHolds, isUnconditional, conditionForEdge, diagnoseTemplate,
  labelLooksLikeCondition, EDGE_FIELDS, EDGE_OPERATORS, getNextNodeIds,
} from '../../src/lib/workflow/edge-conditions.ts';
import { DEFAULT_POLICY_CONFIG, resolvePolicyConfig } from '../../src/lib/procurement/policy-config.ts';
import { workflowTemplates } from '../../src/data/workflows.ts';

const ROOT = new URL('../../', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, ROOT), 'utf8');
let failures = 0;
const ok = (l) => console.log(`  \x1b[32m✓\x1b[0m ${l}`);
const bad = (l, d) => { failures += 1; console.error(`  \x1b[31m✗\x1b[0m ${l}`); if (d) console.error(`      ${d}`); };
const CONFIG = DEFAULT_POLICY_CONFIG;

/**
 * The branch the engine takes — the ENGINE's own function, not a copy of it.
 *
 * My first version of this reimplemented the selection rule, and a deliberately
 * broken engine passed the test: the copy was right while the thing it stood
 * for was wrong. That is the same defect as the mirrored evaluators this
 * tranche has been deleting, reintroduced inside its own guard.
 */
const branchFor = (edges, ctx, config = CONFIG) => {
  const source = edges[0]?.source ?? 'd';
  const [target] = getNextNodeIds(source, edges, ctx.outcome, ctx, config);
  return target;
};

// ── The WF-002 defect, directly ────────────────────────────────────────────
console.log('\nThe catalogue decision decides');
const wf002 = workflowTemplates.find((t) => t.id === 'WF-002');
const decision = wf002.edges.filter((e) => e.source === 'n3');
if (decision.length !== 2) bad('WF-002 n3 has two branches', String(decision.length));
if (decision.some((e) => /€/.test(e.label ?? ''))) {
  bad('no branch label is a currency comparison',
    'a caption that reads like a rule is exactly what evaluated to nothing');
} else ok('no branch is decided by a currency label');

const below = branchFor(decision, { value: 500 });
const above = branchFor(decision, { value: 50_000 });
if (below === above) {
  bad('a cheap and an expensive catalogue order take different branches',
    `both went to ${below} — the decision is not deciding`);
} else ok(`€500 → ${below}, €50,000 → ${above}`);

// The boundary is governed, so it moves with policy rather than with a caption.
const raised = resolvePolicyConfig({ catalogueAutoApprovalThreshold: 20_000 });
if (branchFor(decision, { value: 5_000 }, raised) !== below) {
  bad('raising catalogueAutoApprovalThreshold moves the boundary',
    'a €5,000 order should auto-approve once the threshold is €20,000');
} else ok('raising the governed threshold to €20,000 moves €5,000 onto the auto-approve branch');

// ── Branch selection rules ─────────────────────────────────────────────────
console.log('\nBranch selection is explicit');
const edges = [
  { source: 'd', target: 'high', condition: { field: 'value', operator: 'greater_than', value: '1000' } },
  { source: 'd', target: 'default' },
];
if (branchFor(edges, { value: 5_000 }) !== 'high') bad('a matching condition wins');
if (branchFor(edges, { value: 10 }) !== 'default') bad('the unconditional branch is the default');
if (!isUnconditional({ target: 'x' })) bad('an edge with nothing on it is unconditional');
if (isUnconditional({ label: 'Approved' })) bad('a signal label is a condition', 'Approved means outcome === approved');
if (conditionForEdge({ label: 'Risk required' })?.field !== 'riskRequired') {
  bad('signal labels still resolve', 'existing templates must keep working');
}
if (failures === 0) ok('conditions first, then the unconditional default; signal labels still resolve');

// Signals are part of the vocabulary, not a special case.
for (const field of ['outcome', 'riskRequired', 'onboardingRequired']) {
  if (!EDGE_FIELDS.includes(field)) bad(`${field} is in the edge vocabulary`);
}
if (!EDGE_FIELDS.includes('value') || !EDGE_OPERATORS.includes('greater_than')) {
  bad('the edge vocabulary is the routing vocabulary', 'two dialects is what this removes');
} else ok('edges speak the routing vocabulary plus the workflow signals');

// ── Nothing falls through silently ─────────────────────────────────────────
console.log('\nA branch that cannot fire is reported');
const cases = [
  ['a label that reads like a rule but is not one',
   { nodes: [{ id: 'd', type: 'decision' }, { id: 'a' }, { id: 'b' }],
     edges: [{ source: 'd', target: 'a', label: '> €5K' }, { source: 'd', target: 'b' }] },
   /carries no condition/],
  ['a condition on a field nothing supplies',
   { nodes: [{ id: 'd', type: 'decision' }, { id: 'a' }, { id: 'b' }],
     edges: [{ source: 'd', target: 'a', condition: { field: 'nope', operator: 'equals', value: 'x' } }, { source: 'd', target: 'b' }] },
   /which nothing supplies/],
  ['an unknown governed threshold',
   { nodes: [{ id: 'd', type: 'decision' }, { id: 'a' }, { id: 'b' }],
     edges: [{ source: 'd', target: 'a', condition: { field: 'value', operator: 'greater_than', value: 'policy:nope' } }, { source: 'd', target: 'b' }] },
   /governed threshold that does not exist/],
  ['a decision with no default branch',
   { nodes: [{ id: 'd', type: 'decision' }, { id: 'a' }],
     edges: [{ source: 'd', target: 'a', condition: { field: 'value', operator: 'greater_than', value: '1' } }] },
   /falls through to the first/],
  ['an unreachable branch',
   { nodes: [{ id: 'd', type: 'decision' }, { id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
     edges: [{ source: 'd', target: 'a' }, { source: 'd', target: 'b' }] },
   /can never be reached/],
  ['a decision with no branches at all',
   { nodes: [{ id: 'd', type: 'decision' }], edges: [] },
   /nothing can follow it/],
];
for (const [label, template, pattern] of cases) {
  const problems = diagnoseTemplate(template, CONFIG).flatMap((d) => d.problems).join(' ');
  if (!pattern.test(problems)) bad(`${label} is reported`, problems || '(nothing reported)');
  else ok(`${label} is reported`);
}
if (labelLooksLikeCondition('Approved')) bad('a known signal label is not flagged as a bad condition');
if (!labelLooksLikeCondition('> €5K')) bad('a currency caption is flagged');

// ── The designer persists what it collects ─────────────────────────────────
console.log('\nEvery palette type round-trips');
const palette = read('src/features/admin/workflow-designer/components/node-palette.tsx');
const page = read('src/features/admin/workflow-designer/workflow-designer-page.tsx');
const paletteTypes = [...palette.matchAll(/\{ type: '([a-zA-Z]+)'/g)].map((m) => m[1]);
const reverseBlock = /const reverseType: Record<string, string> = \{([\s\S]*?)\};/.exec(page)?.[1] ?? '';
const mapped = new Set([...reverseBlock.matchAll(/^\s*([a-zA-Z]+):/gm)].map((m) => m[1]));
const unmapped = paletteTypes.filter((t) => !mapped.has(t));
if (unmapped.length) {
  bad('every palette type maps back to a template type',
    `${unmapped.join(', ')} — a node of that kind saves as a plain stage, label intact and kind gone`);
} else ok(`all ${paletteTypes.length} palette types map back`);

// The engine must handle every type reverseType can produce.
const engine = read('src/lib/workflow/engine.ts');
const produced = new Set([...reverseBlock.matchAll(/:\s*'([a-z]+)'/g)].map((m) => m[1]));
for (const type of produced) {
  if (type === 'stage') continue; // the default path
  if (!new RegExp(`case '${type}'`).test(engine)) {
    bad(`the engine handles '${type}'`, 'the designer can produce a node kind the engine does not know');
  }
}
if (failures === 0) ok('the engine handles every type the designer can produce');

// The removed controls must not come back as fields nothing stores.
for (const gone of ['autoApproveConditions', 'allowDelegation', 'escalateOnTimeout', 'actionOnExpiry']) {
  if (new RegExp(gone).test(read('src/features/admin/workflow-designer/components/node-config-panel.tsx'))) {
    bad(`the config panel no longer collects ${gone}`, 'it was never persisted and nothing read it');
  }
}
if (failures === 0) ok('no control collects a field the save path drops');

// An edge condition must survive the round trip, or the designer is decorative.
if (!/e\.data\?\.condition/.test(page)) bad('the save path persists an edge condition');
if (!/e\.condition \? \{ data: \{ condition: e\.condition \} \}/.test(page)) {
  bad('a stored edge condition loads back onto the canvas');
} else ok('edge conditions round-trip through save and load');

// ── The shipped templates ──────────────────────────────────────────────────
console.log('\nThe shipped templates');
const seedProblems = workflowTemplates.flatMap(
  (t) => diagnoseTemplate(t, CONFIG).map((d) => `${t.id} ${d.nodeId}: ${d.problems.join(' ')}`),
);
// WF-001's Auto-Route is a known, deliberate gap: "Direct to Sourcing" has no
// condition because nobody has decided what earns it, and inventing one would
// change who gets approved. It stays reported rather than quietly wired.
const unexpected = seedProblems.filter((p) => !p.startsWith('WF-001 n4:'));
if (unexpected.length) bad('no unexpected template problem', unexpected.join(' | '));
else ok(`${seedProblems.length} known problem(s), all expected`);
if (!seedProblems.some((p) => p.startsWith('WF-001 n4:'))) {
  bad("WF-001's undecided Auto-Route is still reported",
    'it was silently taking the first branch; it must stay visible until someone decides');
} else ok("WF-001's Auto-Route stays reported as undecided");

// ── Live ───────────────────────────────────────────────────────────────────
const env = loadEnv();
const connection = env.NEON_DATABASE_URL || env.DATABASE_URL;
if (!connection) {
  console.log('\n  (skipped live checks — no database connection)');
} else {
  console.log('\nThe live templates branch the same way');
  const sql = neon(connection);
  const rows = await sql`SELECT id, nodes, edges FROM workflow_templates ORDER BY id`;
  const live = rows.find((r) => r.id === 'WF-002');
  const liveDecision = (live?.edges ?? []).filter((e) => e.source === 'n3');
  if (liveDecision.length === 0) bad('WF-002 still has its decision node live');
  else if (branchFor(liveDecision, { value: 500 }) === branchFor(liveDecision, { value: 50_000 })) {
    bad('the live catalogue decision branches on value',
      'both values take the same branch — the backfill has not been applied');
  } else ok('the live catalogue decision branches on value');

  const liveProblems = rows.flatMap(
    (r) => diagnoseTemplate({ nodes: r.nodes ?? [], edges: r.edges ?? [] }, CONFIG)
      .map((d) => `${r.id} ${d.nodeId}: ${d.problems.join(' ')}`),
  ).filter((p) => !p.startsWith('WF-001 n4:'));
  if (liveProblems.length) bad('no unexpected live template problem', liveProblems.join(' | '));
  else ok('no unexpected problem in any live template');
}

console.log(failures === 0 ? '\n\x1b[32medge-conditions passed\x1b[0m' : `\n\x1b[31m${failures} failed\x1b[0m`);
process.exit(failures === 0 ? 0 : 1);
