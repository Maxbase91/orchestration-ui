#!/usr/bin/env node
// The Form Builder offers what the runtime implements, and says when it does not.
//
// Three separate ways this surface promised more than it delivered:
//
//  1. It listed nine stages and omitted `risk` and `onboarding` — while three
//     ACTIVE templates trigger on exactly those. Their stages were invisible,
//     so an admin could not see or remove them, and toggling any other stage
//     wrote the array back with the unseen entry intact.
//  2. The condition FIELD was a free-text input with no vocabulary. A typo
//     fell to `undefined`, evalCondition returned false, and with `.every()`
//     the whole form silently never rendered. Routing rules were given
//     `diagnoseRule` for precisely that failure; forms kept it.
//  3. `blocking` gates a stage and could not be set anywhere — reachable only
//     by a direct database write.
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { loadEnv } from '../lib/live.mjs';
import { diagnoseFormTemplate, diagnoseFormTemplates } from '../../src/lib/forms/diagnose-form-template.ts';
import { lifecycleStagesFrom } from '../../src/lib/workflow/channel-stages.ts';
import { channelStageMapFromTemplates } from '../../src/lib/workflow/channel-stages.ts';
import { workflowTemplates } from '../../src/data/workflows.ts';
import { stageLabel } from '../../src/lib/workflow/stage-labels.ts';
// The lifecycle comes from the templates now — buying-channel-stages.ts is
// deleted. Derived once here rather than restated, which is the point.
const CHANNEL_STAGES = channelStageMapFromTemplates(workflowTemplates);

import { DEFAULT_POLICY_CONFIG } from '../../src/lib/procurement/policy-config.ts';
import { formTemplates } from '../../src/data/form-templates.ts';

const ROOT = new URL('../../', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, ROOT), 'utf8');
let failures = 0;
const ok = (l) => console.log(`  \x1b[32m✓\x1b[0m ${l}`);
const bad = (l, d) => { failures += 1; console.error(`  \x1b[31m✗\x1b[0m ${l}`); if (d) console.error(`      ${d}`); };

const STAGES = lifecycleStagesFrom(CHANNEL_STAGES);
const CTX = { stages: STAGES, config: DEFAULT_POLICY_CONFIG };
const builder = read('src/features/admin/forms/form-builder-page.tsx');

const form = (over = {}) => ({
  id: 'F', name: 'F', description: '', status: 'active', category: 'All',
  triggerStages: ['risk'], triggerConditions: [], blocking: false,
  fields: [], version: 1, lastModified: '', createdBy: '', ...over,
});

// ── The stage list covers what templates actually use ──────────────────────
console.log('\nThe builder offers every stage a form can trigger on');
if (!STAGES.includes('risk') || !STAGES.includes('onboarding')) {
  bad('the lifecycle includes risk and onboarding',
    `got ${STAGES.join(', ')} — the nine-stage list is exactly what hid three active forms`);
} else ok(`${STAGES.length} stages, risk and onboarding included`);

if (/const STAGES = \[/.test(builder)) {
  bad('the builder derives its stage list', 'a restated list is how the two omissions got in');
} else ok('the builder derives its stage list from the lifecycle');

// Labels live in src/lib/workflow/stage-labels.ts now — there were four copies
// with three different answers for `po`, and two of them missing risk and
// onboarding entirely, so those stages rendered as raw ids.
const unlabelled = STAGES.filter((stage) => stageLabel(stage) === stage);
if (unlabelled.length) bad('every offered stage has a label', `${unlabelled.join(', ')} would render as a raw id`);
else ok('every offered stage has a label');

// Every stage the seeded templates trigger on must be offerable.
const seededStages = [...new Set(formTemplates.flatMap((t) => t.triggerStages))];
const unofferable = seededStages.filter((stage) => !STAGES.includes(stage));
if (unofferable.length) {
  bad('every stage a seeded template uses is offered by the builder',
    `${unofferable.join(', ')} — invisible in the builder, so un-removable`);
} else ok(`all ${seededStages.length} stages used by seeded templates are offerable`);

// ── The condition editor is the shared one ─────────────────────────────────
console.log('\nThe condition editor is the routing editor');
if (!/ConditionCard/.test(builder)) {
  bad('the builder uses ConditionCard',
    'its own free-text field input offered no vocabulary and no diagnosis');
} else ok('the builder uses the shared ConditionCard');
if (/placeholder="Field"/.test(builder)) bad('the free-text field input is gone', 'still present');
else ok('the free-text field input is gone');
// The builder used to offer five operators while the evaluator implemented
// eleven; now it offers the evaluator's list because it is the same component.
if (/<SelectItem value="greater_than">greater than<\/SelectItem>/.test(builder)) {
  bad('the builder does not restate the operator list', 'a restated subset is how five of eleven were offered');
} else ok('the builder does not restate the operator list');

// ── blocking is settable ───────────────────────────────────────────────────
console.log('\nA blocking form can be configured');
if (!/blocking: checked/.test(builder)) {
  bad('the builder can set blocking',
    'the column gates a stage and was reachable only by a direct database write');
} else ok('the builder can set blocking');

// ── Diagnostics ────────────────────────────────────────────────────────────
console.log('\nA form that cannot fire says so');
const cases = [
  ['an unknown field', form({ triggerConditions: [{ field: 'categry', operator: 'equals', value: 'x' }] }), /Unknown field/],
  ['an unsupported operator', form({ triggerConditions: [{ field: 'category', operator: 'sounds_like', value: 'x' }] }), /Unsupported operator/],
  ['a stage no channel traverses', form({ triggerStages: ['nowhere'] }), /not a stage any channel traverses/],
  ['no trigger stage at all', form({ triggerStages: [] }), /never asked for/],
  ['an unknown governed threshold', form({ triggerConditions: [{ field: 'value', operator: 'greater_than', value: 'policy:nope' }] }), /Unknown governed threshold/],
  ['a one-bound between', form({ triggerConditions: [{ field: 'value', operator: 'between', value: '5000' }] }), /two comma-separated bounds/],
  // The routing vocabulary has ten fields; a form's context supplies seven.
  ['a field the form context never supplies', form({ triggerConditions: [{ field: 'riskRating', operator: 'equals', value: 'high' }] }), /Nothing supplies "riskRating"/],
];
for (const [label, template, pattern] of cases) {
  const problems = diagnoseFormTemplate(template, CTX).join(' ');
  if (!pattern.test(problems)) bad(`${label} is reported`, problems || '(no problems reported)');
  else ok(`${label} is reported`);
}

// A blocking form that cannot fire is the worst case and says so explicitly.
const blockingBroken = diagnoseFormTemplate(
  form({ blocking: true, triggerConditions: [{ field: 'nope', operator: 'equals', value: 'x' }] }), CTX,
).join(' ');
if (!/strands every request/.test(blockingBroken)) {
  bad('a broken BLOCKING form says it strands requests', blockingBroken);
} else ok('a broken blocking form is called out as stranding its stage');

// A healthy form reports nothing, or the diagnostics are noise.
const healthy = form({ triggerConditions: [{ field: 'category', operator: 'equals', value: 'software' }] });
if (diagnoseFormTemplate(healthy, CTX).length !== 0) {
  bad('a healthy form reports no problems', diagnoseFormTemplate(healthy, CTX).join(' '));
} else ok('a healthy form reports no problems');
const governed = form({ triggerConditions: [{ field: 'value', operator: 'greater_than', value: 'policy:budgetApprovalThreshold' }] });
if (diagnoseFormTemplate(governed, CTX).length !== 0) {
  bad('a governed threshold is not reported as unknown', diagnoseFormTemplate(governed, CTX).join(' '));
} else ok('a form condition may reference a governed threshold');

// ── The seeded set is healthy ──────────────────────────────────────────────
console.log('\nNo seeded template is broken');
const seededProblems = diagnoseFormTemplates(formTemplates, CTX);
if (seededProblems.length) {
  bad('every active seeded template can fire',
    seededProblems.map((d) => `${d.templateId}: ${d.problems.join(' ')}`).join(' | '));
} else ok(`all ${formTemplates.filter((t) => t.status === 'active').length} active seeded templates can fire`);

// ── Live ───────────────────────────────────────────────────────────────────
const env = loadEnv();
const connection = env.NEON_DATABASE_URL || env.DATABASE_URL;
if (!connection) {
  console.log('\n  (skipped live checks — no database connection)');
} else {
  console.log('\nNo live template is broken');
  const sql = neon(connection);
  const rows = await sql`
    SELECT id, name, status, trigger_stages, trigger_conditions, blocking FROM form_templates ORDER BY id`;
  const live = rows.map((r) => ({
    id: r.id, name: r.name, status: r.status,
    triggerStages: r.trigger_stages ?? [],
    triggerConditions: r.trigger_conditions ?? [],
    blocking: r.blocking === true,
  }));
  const liveProblems = diagnoseFormTemplates(live, CTX);
  if (liveProblems.length) {
    bad('every active live template can fire',
      liveProblems.map((d) => `${d.templateId}: ${d.problems.join(' ')}`).join(' | '));
  } else ok(`all ${live.filter((t) => t.status === 'active').length} active live templates can fire`);
}

console.log(failures === 0 ? '\n\x1b[32mform-builder passed\x1b[0m' : `\n\x1b[31m${failures} failed\x1b[0m`);
process.exit(failures === 0 ? 0 : 1);
