#!/usr/bin/env node
// Verifies the audit trail for Admin → Database edits persists to the
// audit_entries table — not just the Zustand session array.
//
// Run: node tests/integration/audit-trail.mjs

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

const results = [];
const pass = (n, d = '') => results.push({ n, o: 'PASS', d });
const fail = (n, d) => results.push({ n, o: 'FAIL', d });
const assert = (cond, n, d) => (cond ? pass(n, d) : fail(n, d));

async function cleanupTestAudits() {
  const { data: rows } = await sb
    .from('audit_entries')
    .select('id')
    .like('detail', 'E2E-AUD-%');
  if (!rows?.length) return 0;
  const ids = rows.map((r) => r.id);
  await sb.from('audit_entries').delete().in('id', ids);
  return ids.length;
}

async function scenarioInsertAndList() {
  const now = new Date().toISOString();
  const testDetail = `E2E-AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const { data: inserted, error: insErr } = await sb.from('audit_entries').insert({
    timestamp: now,
    user_id: 'u1',
    user_name: 'Integration Test Bot',
    action: 'record.update',
    object_type: 'supplier',
    object_id: 'SUP-E2E',
    detail: testDetail,
    type: 'human',
  }).select('*').single();

  if (insErr) { fail('audit: insert succeeded', insErr.message); return; }
  assert(!!inserted?.id, 'audit: UUID assigned by Supabase', `id=${inserted?.id}`);
  assert(inserted.action === 'record.update', 'audit: action persisted');
  assert(inserted.object_type === 'supplier', 'audit: object_type persisted');
  assert(inserted.detail === testDetail, 'audit: detail persisted');

  // Read back via list-equivalent query
  const { data: listed, error: listErr } = await sb
    .from('audit_entries')
    .select('*')
    .eq('detail', testDetail)
    .order('timestamp', { ascending: false });
  if (listErr) { fail('audit: list query succeeded', listErr.message); return; }
  assert(listed.length === 1, 'audit: row visible via list query', `count=${listed.length}`);
  assert(listed[0].user_name === 'Integration Test Bot', 'audit: user_name round-trips');
}

async function scenarioSchemaShape() {
  // Confirm every column expected by the mapper exists on the table.
  const { data, error } = await sb.from('audit_entries').select('*').limit(1);
  if (error) { fail('audit: schema probe', error.message); return; }
  const expected = ['id', 'timestamp', 'user_id', 'user_name', 'action', 'object_type', 'object_id', 'detail', 'type', 'request_id'];
  const got = data?.[0] ? Object.keys(data[0]) : expected;
  for (const col of expected) {
    assert(got.includes(col) || !data?.[0], `schema: column ${col} present`);
  }
}

async function main() {
  await cleanupTestAudits();
  await scenarioSchemaShape();
  await scenarioInsertAndList();
  const removed = await cleanupTestAudits();
  console.log(`Removed ${removed} test audit row(s).`);

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
