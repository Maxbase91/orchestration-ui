#!/usr/bin/env node
// Every form is asked at a stage that exists, and where it can be answered.
//
// Two defects this pins, both found reviewing why REQ-2025-9362 sat in
// validation for seven days:
//
//   1. FORM-003 (Vendor Onboarding) had `supplier-onboarding` as its trigger
//      stage. That is not a RequestStatus, so the form never fired once — the
//      onboarding stage ran for months without the form written for it, and
//      nothing failed, because a form that matches no stage is indistinguishable
//      from a form nobody reached.
//   2. Every request in `validation` rendered two risk questionnaires (22
//      fields) because `forStage()` matched on stage alone. Validation is the
//      category manager's routing check; it captures nothing.
//
// Source-level: the seed data in src/data/form-templates.ts. Live: the
// form_templates table, when a database is reachable.
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { loadEnv } from '../lib/live.mjs';
import { channelStageMapFromTemplates, lifecycleStagesFrom } from '../../src/lib/workflow/channel-stages.ts';
import { workflowTemplates } from '../../src/data/workflows.ts';
import { formTemplates } from '../../src/data/form-templates.ts';

const ROOT = new URL('../../', import.meta.url);
let failures = 0;
const ok = (label) => console.log(`  \x1b[32m✓\x1b[0m ${label}`);
const bad = (label, detail) => {
  failures += 1;
  console.error(`  \x1b[31m✗\x1b[0m ${label}`);
  if (detail) console.error(`      ${detail}`);
};

// The stage vocabulary, read from the type rather than restated here.
const STATUSES = new Set(
  readFileSync(new URL('src/data/types.ts', ROOT), 'utf8')
    .match(/export type RequestStatus = ([^;]+);/)[1]
    .split('|').map((part) => part.trim().replace(/^'|'$/g, '')),
);

/** Stages that must never carry a form, with the reason. */
const NO_FORM_STAGES = {
  validation: 'the category manager\'s routing check — it decides, it does not capture',
};

console.log('\nSeed templates (src/data/form-templates.ts)');
// The seed array itself, not a regex over its source: the scrape needed a
// floor ("at least 8") to notice it had stopped parsing, and that floor broke
// the day three unused forms were deleted.
if (formTemplates.length === 0) bad('the seed has form templates', 'none');
else ok(`${formTemplates.length} seeded templates`);

for (const { id, status, triggerStages: stages } of formTemplates) {
  for (const stage of stages) {
    if (!STATUSES.has(stage)) {
      bad(`${id} triggers on a real stage`, `"${stage}" is not a RequestStatus — the form can never fire`);
    }
  }
  if (status === 'active') {
    for (const [stage, why] of Object.entries(NO_FORM_STAGES)) {
      if (stages.includes(stage)) bad(`${id} does not trigger on ${stage}`, why);
    }
  }
}
if (failures === 0) ok('every trigger stage is a RequestStatus, and none is a no-form stage');

// A form whose stage no channel traverses is unreachable in practice.
// Derived from the templates rather than scraped out of a source file. The
// file this used to grep — buying-channel-stages.ts — is deleted, and grepping
// quoted strings out of it was always a proxy for the real question.
const reachable = new Set(lifecycleStagesFrom(channelStageMapFromTemplates(workflowTemplates)));
for (const { id, status, triggerStages: stages } of formTemplates) {
  if (status !== 'active') continue;
  if (stages.length > 0 && !stages.some((s) => reachable.has(s))) {
    bad(`${id} sits on a stage some channel traverses`, `${JSON.stringify(stages)} is on no channel's path`);
  }
}

// ── Live check ──────────────────────────────────────────────────────────────
const env = loadEnv();
const connection = env.NEON_DATABASE_URL ?? env.DATABASE_URL;
if (!connection) {
  console.log('\nLive form_templates — skipped: no database configured');
  if (process.env.REQUIRE_LIVE === '1') {
    console.error('REQUIRE_LIVE=1 and no database is configured.');
    process.exit(1);
  }
} else {
  console.log('\nLive form_templates');
  const sql = neon(connection);
  const rows = await sql`SELECT id, name, status, trigger_stages FROM form_templates ORDER BY id`;
  for (const row of rows) {
    for (const stage of row.trigger_stages ?? []) {
      if (!STATUSES.has(stage)) bad(`${row.id} triggers on a real stage`, `"${stage}" is not a RequestStatus`);
    }
    if (row.status === 'active') {
      for (const [stage, why] of Object.entries(NO_FORM_STAGES)) {
        if ((row.trigger_stages ?? []).includes(stage)) bad(`${row.id} does not trigger on ${stage}`, why);
      }
    }
  }
  ok(`${rows.length} live templates checked`);
  const active = rows.filter((r) => r.status === 'active');
  console.log(`  active: ${active.map((r) => `${r.id}→${(r.trigger_stages ?? []).join(',')}`).join('  ')}`);
}

// ── The builder offers only what the runtime implements ─────────────────────
// The trigger evaluator was an inline `.some()` implementing one field/operator
// pair and returning `true` for anything else, so a single unrecognised
// condition made the whole set pass. The builder offered five operators and one
// worked. It shares the routing evaluator now.
console.log('\nThe builder and the evaluator agree');
const builder = readFileSync(new URL('src/features/admin/forms/form-builder-page.tsx', ROOT), 'utf8');
const routing = readFileSync(new URL('src/lib/routing/evaluate-routing-rules.ts', ROOT), 'utf8');
const supportedOperators = new Set(
  [...(/const SUPPORTED_OPERATORS = \[([\s\S]*?)\]/.exec(routing)?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]),
);
// The operator dropdown in the trigger-condition editor.
const offeredOperators = [...builder.matchAll(/<SelectItem value="([a-z_]+)">/g)].map((m) => m[1])
  .filter((op) => /equals|contains|than|empty|in|between|starts/.test(op));
const unimplemented = [...new Set(offeredOperators)].filter((op) => !supportedOperators.has(op));
if (unimplemented.length === 0) ok(`every offered operator is implemented (${supportedOperators.size} available)`);
else bad('every offered operator is implemented', `${unimplemented.join(', ')} would silently pass or fail`);

// The predicate moved out of the renderer into src/lib/forms/form-triggers.ts
// when the blocking gate was found not to be evaluating conditions at all.
// These assertions follow it there — checking the renderer would now only
// prove the code is absent, not that it is correct. test:form-gates asserts
// the behaviour itself, including that the blocking set is a subset of what
// renders.
const triggers = readFileSync(new URL('src/lib/forms/form-triggers.ts', ROOT), 'utf8');
if (/conditions\.some\(/.test(triggers)) {
  bad('trigger conditions are ANDed', '`.some()` is back — one unknown condition makes the set pass');
} else ok('trigger conditions are ANDed, matching the builder\'s own wording');
if (/evalCondition\(/.test(triggers)) ok('the form evaluator is the routing evaluator');
else bad('the form evaluator is shared', 'a second evaluator has appeared');

// ── Every pre-populate token has a producer ─────────────────────────────────
// The dropdown offered seven request tokens no producer supplied, so an admin
// picked "Cost Centre" and the field came up empty.
console.log('\nEvery pre-populate token resolves');
const producer = readFileSync(new URL('src/lib/procurement/form-prepopulate.ts', ROOT), 'utf8');
const produced = new Set(
  [...(/const PREPOPULATE_TOKENS = \[([\s\S]*?)\] as const/.exec(producer)?.[1] ?? '').matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]),
);
const offeredTokens = [...(/const PRE_POPULATE_OPTIONS[^=]*=\s*\[([\s\S]*?)\];/.exec(builder)?.[1] ?? '')
  .matchAll(/value: '([^']*)'/g)].map((m) => m[1]).filter(Boolean);
// `sow.` tokens come from sowPrePopulateValues in service-description-seed.ts.
const deadTokens = offeredTokens.filter((t) => !t.startsWith('sow.') && !produced.has(t));
if (deadTokens.length === 0) ok(`all ${offeredTokens.length} offered tokens have a producer`);
else bad('every offered token has a producer', deadTokens.join(', '));

// ── A blocking form actually blocks ─────────────────────────────────────────
// The `blocking` filter lives in the shared predicate now; the gate's job is
// to consult it and to hold the action while anything is outstanding.
const gate = readFileSync(new URL('src/features/requests/request-detail/components/action-buttons.tsx', ROOT), 'utf8');
if (/outstandingBlockingForms\(/.test(gate) && /outstandingForms\.length > 0/.test(gate)) {
  ok('the stage gate reads blocking forms');
} else {
  bad('the stage gate reads blocking forms', 'forms are decorative again — nothing consults form_submissions');
}

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exit(1); }
console.log('Form placement is coherent.');
