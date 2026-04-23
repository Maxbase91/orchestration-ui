#!/usr/bin/env node
// Verifies the Phase-3 Supabase views project live-derived values:
//   supplier.activeContracts  = count of active/expiring contracts
//   supplier.totalSpend12m    = sum of invoices in last 365 days
//   contract.linkedRequestIds = array of requests with contract_id = X
//
// Uses service-role key directly against the views so we can confirm
// the view SQL is correct without round-tripping through the UI.
//
// Run: node tests/integration/derived-fields.mjs

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

const PREFIX = 'E2E-DRV-';

async function cleanup() {
  // Requests first (they reference contracts), then invoices, then
  // contracts. FK on delete for some is SET NULL which is fine.
  await sb.from('requests').delete().like('id', `${PREFIX}%`);
  await sb.from('invoices').delete().like('id', `${PREFIX}%`);
  await sb.from('contracts').delete().like('id', `${PREFIX}%`);
}

async function pickTestSupplier() {
  const { data } = await sb.from('suppliers').select('id,name').limit(1);
  if (!data?.[0]) throw new Error('no suppliers in DB');
  return data[0];
}

async function scenarioActiveContractsLive() {
  const supplier = await pickTestSupplier();
  const { data: before } = await sb
    .from('suppliers_with_derived').select('active_contracts_live').eq('id', supplier.id).single();
  const baseline = before?.active_contracts_live ?? 0;

  const cid = `${PREFIX}CON-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const { error: insErr } = await sb.from('contracts').insert({
    id: cid,
    title: 'E2E derived-fields test contract',
    supplier_id: supplier.id,
    supplier_name: supplier.name,
    value: 100000,
    start_date: '2025-01-01',
    end_date: '2026-01-01',
    status: 'active',
    owner_id: 'u1',
    owner_name: 'Test Owner',
    department: 'Test',
    category: 'Test',
    utilisation_percentage: 0,
  });
  if (insErr) { fail('derived: insert contract', insErr.message); return; }

  const { data: after } = await sb
    .from('suppliers_with_derived').select('active_contracts_live').eq('id', supplier.id).single();
  assert(
    after?.active_contracts_live === baseline + 1,
    'derived: activeContracts increments when new active contract added',
    `before=${baseline} after=${after?.active_contracts_live}`,
  );
}

async function scenarioTotalSpend12mLive() {
  const supplier = await pickTestSupplier();
  const { data: before } = await sb
    .from('suppliers_with_derived').select('total_spend_12m_live').eq('id', supplier.id).single();
  const baseline = Number(before?.total_spend_12m_live ?? 0);

  const iid = `${PREFIX}INV-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const { error: insErr } = await sb.from('invoices').insert({
    id: iid,
    supplier_id: supplier.id,
    supplier_name: supplier.name,
    amount: 50000,
    currency: 'EUR',
    status: 'paid',
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: new Date().toISOString().slice(0, 10),
    match_status: 'matched',
  });
  if (insErr) { fail('derived: insert invoice', insErr.message); return; }

  const { data: after } = await sb
    .from('suppliers_with_derived').select('total_spend_12m_live').eq('id', supplier.id).single();
  assert(
    Math.round(Number(after?.total_spend_12m_live ?? 0)) === baseline + 50000,
    'derived: totalSpend12m increments when new invoice added',
    `before=${baseline} after=${after?.total_spend_12m_live}`,
  );
}

async function scenarioLinkedRequestIdsLive() {
  // Pick any contract to attach a request to. Skip if requests table
  // has no user to reference.
  const { data: contracts } = await sb.from('contracts').select('id').limit(1);
  const contractId = contracts?.[0]?.id;
  if (!contractId) { fail('derived: pick contract for linkedRequestIds', 'no contracts'); return; }

  const { data: before } = await sb
    .from('contracts_with_derived').select('linked_request_ids_live').eq('id', contractId).single();
  const baseline = before?.linked_request_ids_live ?? [];

  const { data: anyUser } = await sb.from('users').select('id').limit(1).single();
  if (!anyUser) { fail('derived: no users in DB', ''); return; }

  const rid = `${PREFIX}REQ-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const { error: insErr } = await sb.from('requests').insert({
    id: rid,
    title: 'E2E derived-fields test request',
    category: 'goods',
    status: 'draft',
    priority: 'medium',
    value: 1000,
    currency: 'EUR',
    requestor_id: anyUser.id,
    owner_id: anyUser.id,
    contract_id: contractId,
    is_urgent: false,
    days_in_stage: 0,
    is_overdue: false,
    refer_back_count: 0,
  });
  if (insErr) { fail('derived: insert request with contract_id', insErr.message); return; }

  const { data: after } = await sb
    .from('contracts_with_derived').select('linked_request_ids_live').eq('id', contractId).single();
  const next = after?.linked_request_ids_live ?? [];
  assert(next.includes(rid), 'derived: linkedRequestIds includes new request', `baseline=${baseline.length} after=${next.length}`);
}

async function main() {
  await cleanup();
  await scenarioActiveContractsLive();
  await scenarioTotalSpend12mLive();
  await scenarioLinkedRequestIdsLive();
  await cleanup();

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
