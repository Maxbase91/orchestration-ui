#!/usr/bin/env node
// Configuration reaches the thing it configures.
//
// The repeated defect in this codebase is config that looks maintained and
// drives nothing: request_supplier_candidates written and read by nothing;
// FORM-003 sitting on a stage id that does not exist and never firing once; a
// confirm card rendering a sentence the executor never read. Each looked fine on
// screen. These checks assert the couplings an audit had to trace by hand, so
// they cannot come apart again quietly.
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { loadEnv } from '../lib/live.mjs';
import { firstActionableStage, getStagesForChannel } from '../../src/lib/workflow/buying-channel-stages.ts';

const ROOT = new URL('../../', import.meta.url);
let failures = 0;
const ok = (label) => console.log(`  \x1b[32m✓\x1b[0m ${label}`);
const bad = (label, detail) => {
  failures += 1;
  console.error(`  \x1b[31m✗\x1b[0m ${label}`);
  if (detail) console.error(`      ${detail}`);
};

// ── The intake writer agrees with the stepper ───────────────────────────────
// api/_domains/intake-submit.ts wrote a constant `validation` for every channel.
// When validation became procurement-led-only, business-led and direct-po
// requests landed in a stage their own channel skips — the stepper drew them as
// skipped while they sat in them.
console.log('\nThe first actionable stage is one the channel traverses');
const CHANNELS = ['catalogue', 'direct-po', 'business-led', 'framework-call-off', 'p-card', 'procurement-led'];
for (const channel of CHANNELS) {
  for (const risk of [false, true]) {
    const stage = firstActionableStage(channel, { riskAssessmentRequired: risk });
    const traversed = getStagesForChannel(channel);
    if (traversed.includes(stage)) continue;
    bad(`${channel} (risk=${risk}) lands on a traversed stage`,
      `${stage} is not in ${JSON.stringify(traversed)}`);
  }
}
if (failures === 0) ok(`all ${CHANNELS.length} channels land on a stage they traverse`);

// `intake` is never a landing stage — intake is what just completed.
for (const channel of CHANNELS) {
  if (firstActionableStage(channel) === 'intake') bad(`${channel} does not land back on intake`);
}

const intakeWriter = readFileSync(new URL('api/_domains/intake-submit.ts', ROOT), 'utf8');
if (/const INITIAL_STAGE = \{ status: 'validation'/.test(intakeWriter)) {
  bad('the intake writer derives its stage', 'the hardcoded INITIAL_STAGE constant is back');
} else ok('the intake writer derives its stage from the channel');

// ── Neither serverless writer hardcodes a workflow node id ──────────────────
// `n3` is Validation in WF-001 and a *decision* node in WF-002, so the literal
// parked WF-002 requests somewhere the engine cannot resume from.
console.log('\nWorkflow node ids come from the template');
if (/current_node_ids: json\(\['n\d+'\]\)/.test(intakeWriter)) {
  bad('intake-submit resolves its start node', 'a literal node id is back in the instance insert');
} else ok('intake-submit resolves its start node from the template');

// ── Live: no request sits in a stage its channel skips ──────────────────────
const env = loadEnv();
const connection = env.NEON_DATABASE_URL ?? env.DATABASE_URL;
if (!connection) {
  console.log('\nLive lifecycle — skipped: no database configured');
  if (process.env.REQUIRE_LIVE === '1') {
    console.error('REQUIRE_LIVE=1 and no database is configured.');
    process.exit(1);
  }
} else {
  console.log('\nLive requests sit in stages their channel traverses');
  const sql = neon(connection);
  const rows = await sql`
    SELECT id, status, buying_channel FROM requests
    WHERE buying_channel IS NOT NULL
      AND status NOT IN ('draft', 'completed', 'cancelled', 'referred-back')
  `;
  const offenders = rows.filter((row) => !getStagesForChannel(row.buying_channel).includes(row.status));
  if (offenders.length === 0) ok(`${rows.length} active request(s), none in a skipped stage`);
  else {
    bad(`${offenders.length} request(s) are in a stage their channel skips`,
      offenders.slice(0, 8).map((r) => `${r.id} ${r.buying_channel}/${r.status}`).join(', '));
  }
}

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exit(1); }
console.log('Configuration reaches what it configures.');
