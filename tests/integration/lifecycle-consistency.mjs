#!/usr/bin/env node
// Verifies that every request's stage_history and workflow_step_details
// respect the buying-channel stage rules:
//
//   catalogue:          intake → po → receipt → invoice → payment
//   direct-po:          skip sourcing + contracting
//   business-led:       skip sourcing + contracting
//   framework-call-off: skip sourcing + contracting
//   procurement-led:    full 9-stage flow
//
// Run: node tests/integration/lifecycle-consistency.mjs

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  const raw = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const sb = createClient(
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const SKIP = {
  'catalogue':          new Set(['validation', 'approval', 'sourcing', 'contracting']),
  'direct-po':          new Set(['sourcing', 'contracting']),
  'business-led':       new Set(['sourcing', 'contracting']),
  'framework-call-off': new Set(['sourcing', 'contracting']),
};

const results = [];
const pass = (n, d = '') => results.push({ n, o: 'PASS', d });
const fail = (n, d) => results.push({ n, o: 'FAIL', d });
const assert = (cond, n, d) => (cond ? pass(n, d) : fail(n, d));

async function main() {
  const { data: reqs } = await sb.from('requests').select('id,buying_channel');
  const { data: sh } = await sb.from('stage_history').select('request_id,stage');
  const { data: wsd } = await sb.from('workflow_step_details').select('request_id,stage');

  const byId = new Map();
  for (const r of reqs ?? []) byId.set(r.id, { channel: r.buying_channel, sh: [], wsd: [] });
  for (const h of sh ?? [])  byId.get(h.request_id)?.sh.push(h.stage);
  for (const d of wsd ?? []) byId.get(d.request_id)?.wsd.push(d.stage);

  const violations = [];
  for (const [id, r] of byId) {
    const skip = SKIP[r.channel];
    if (!skip) continue;
    const badSh = r.sh.filter((s) => skip.has(s));
    const badWsd = r.wsd.filter((s) => skip.has(s));
    if (badSh.length || badWsd.length) {
      violations.push({ id, channel: r.channel, stage_history: badSh, workflow_step_details: badWsd });
    }
  }

  assert(
    violations.length === 0,
    'lifecycle-consistency: no requests carry stage data for channels that skip those stages',
    violations.length === 0
      ? 'clean'
      : violations.map((v) => `${v.id} (${v.channel}): ${[...v.stage_history, ...v.workflow_step_details].join(',')}`).join(' · '),
  );

  // Sanity-check: procurement-led requests should have sourcing or
  // contracting history at least some of the time — otherwise our
  // seed is pathologically empty.
  const procLed = [...byId.values()].filter((r) => r.channel === 'procurement-led');
  const withSourcing = procLed.filter((r) => r.sh.includes('sourcing') || r.wsd.includes('sourcing'));
  assert(
    withSourcing.length >= 1,
    'lifecycle-consistency: at least one procurement-led request has sourcing history',
    `${withSourcing.length} of ${procLed.length} procurement-led requests have sourcing data`,
  );

  const failed = results.filter((r) => r.o === 'FAIL').length;
  for (const r of results) {
    const tag = r.o === 'PASS' ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    console.log(`  ${tag}  ${r.n}`);
    if (r.d) console.log(`        ${r.d}`);
  }
  console.log(`\n  ${results.length - failed} passed, ${failed} failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
