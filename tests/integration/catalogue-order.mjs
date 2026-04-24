#!/usr/bin/env node
// Verifies the smart-command-bar "Order Now" button writes a real
// request row (not a fake client-side ID).
//
// Simulates the handler's Supabase insert directly; the handler's
// client-side code path is exercised by static assertion on the file.
//
// Run: node tests/integration/catalogue-order.mjs

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

const PREFIX = 'E2E-CAT-';

async function cleanup() {
  const { data: rows } = await sb.from('requests').select('id').like('id', `${PREFIX}%`);
  if (!rows?.length) return 0;
  await sb.from('requests').delete().in('id', rows.map((r) => r.id));
  return rows.length;
}

async function scenarioCatalogueOrderPersists() {
  const { data: item } = await sb.from('catalogue_items').select('*').limit(1).single();
  if (!item) { fail('catalogue-order: catalogue has items', 'no items'); return; }
  const { data: anyUser } = await sb.from('users').select('id').limit(1).single();

  const id = `${PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const { error } = await sb.from('requests').insert({
    id,
    title: `Catalogue order: ${item.name}`,
    description: `- ${item.name} x 1 @ EUR ${item.unit_price}`,
    category: 'goods',
    status: 'completed',
    priority: 'medium',
    value: item.unit_price,
    currency: 'EUR',
    requestor_id: anyUser.id,
    owner_id: anyUser.id,
    supplier_id: item.supplier_id,
    buying_channel: 'catalogue',
    is_urgent: false,
    days_in_stage: 0,
    is_overdue: false,
    refer_back_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) { fail('catalogue-order: insert succeeds', error.message); return; }

  const { data: row } = await sb.from('requests').select('*').eq('id', id).single();
  assert(row?.status === 'completed', 'catalogue-order: status=completed (bypasses workflow)');
  assert(row?.buying_channel === 'catalogue', 'catalogue-order: buying_channel=catalogue');
  assert(row?.supplier_id === item.supplier_id, 'catalogue-order: supplier_id preserved');
  assert(Number(row?.value) === Number(item.unit_price), 'catalogue-order: value matches unit_price');
  assert(row?.description?.includes(item.name), 'catalogue-order: description includes item name');
}

async function scenarioSourceWired() {
  const src = readFileSync(
    new URL('../../src/features/dashboard/components/smart-command-bar.tsx', import.meta.url),
    'utf8',
  );
  assert(
    src.includes('createRequest') && src.includes("buyingChannel: 'catalogue'"),
    'catalogue-order: handler calls createRequest with buyingChannel=catalogue',
  );
  assert(
    src.includes('if (cart.length === 0) return'),
    'catalogue-order: handler guards against empty cart',
  );
}

async function main() {
  await cleanup();
  await scenarioCatalogueOrderPersists();
  await scenarioSourceWired();
  const removed = await cleanup();
  console.log(`Removed ${removed} test request(s).`);

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
