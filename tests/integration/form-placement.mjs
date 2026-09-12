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
const source = readFileSync(new URL('src/data/form-templates.ts', ROOT), 'utf8');
// One record per `id: 'FORM-xxx'`, up to the next one.
const blocks = [...source.matchAll(/id: '(FORM-\d+)'[\s\S]*?(?=id: 'FORM-\d+'|\n\];)/g)];
if (blocks.length < 8) bad('all templates parsed', `found ${blocks.length}, expected at least 8`);
else ok(`parsed ${blocks.length} templates`);

for (const [block, id] of blocks) {
  const status = /status: '(\w+)'/.exec(block)?.[1];
  const stages = [...(/triggerStages: \[([^\]]*)\]/.exec(block)?.[1] ?? '')
    .matchAll(/'([^']+)'/g)].map((m) => m[1]);
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
const channels = readFileSync(new URL('src/lib/workflow/buying-channel-stages.ts', ROOT), 'utf8');
const reachable = new Set([...channels.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]).filter((s) => STATUSES.has(s)));
for (const [block, id] of blocks) {
  if (!/status: 'active'/.test(block)) continue;
  const stages = [...(/triggerStages: \[([^\]]*)\]/.exec(block)?.[1] ?? '')
    .matchAll(/'([^']+)'/g)].map((m) => m[1]);
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

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exit(1); }
console.log('Form placement is coherent.');
