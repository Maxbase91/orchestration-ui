#!/usr/bin/env node
// Verifies the Phase-3 database views project live-derived values:
//   supplier.activeContracts  = count of active/expiring contracts still in force
//   supplier.totalSpend12m    = sum of invoices in last 365 days
//   contract.linkedRequestIds = array of requests with contract_id = X
//   contract.status           = read from the end date against the renewal
//                               window (status_live, 2026-09-26) — the same
//                               answer as lib/procurement/contract-status.ts
//
// Uses service-role key directly against the views so we can confirm
// the view SQL is correct without round-tripping through the UI.
//
// Run: node tests/integration/derived-fields.mjs

import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { neonClient, requireConnection } from '../lib/live.mjs';
import { contractStatusOn } from '../../src/lib/procurement/contract-status.ts';

const sb = await neonClient('derived');

const results = [];
const pass = (n, d = '') => results.push({ n, o: 'PASS', d });
const fail = (n, d) => results.push({ n, o: 'FAIL', d });
const assert = (cond, n, d) => (cond ? pass(n, d) : fail(n, d));

const PREFIX = 'E2E-DRV-';

// The database's own calendar and the governed window: what the view reads.
// The policy row is not on /api/db's allowlist, so it is read directly.
const sql = neon(requireConnection('derived'));
const [{ today }] = await sql`SELECT to_char(current_date, 'YYYY-MM-DD') AS today`;
const [policy] = await sql`SELECT config->>'contractExpiryBufferDays' AS days FROM procurement_policy_configs WHERE singleton_key = 'default'`;
const windowDays = policy?.days != null ? Math.floor(Number(policy.days)) : null;
/** An ISO date `offset` days from the database's today. */
const dayFromToday = (offset) => new Date(Date.parse(`${today}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);

/**
 * Remove this suite's fixtures.
 *
 * It used to delete with `.like('id', 'E2E-DRV-%')` and ignore the result. A
 * pattern match is not a filter /api/db accepts for a destructive write — an
 * unauthenticated endpoint should not take "everything starting with" as a
 * delete predicate — so the calls were refused, and because nothing read the
 * error the suite left one contract behind per run. They accumulated in the
 * live store until test:neon-live started failing on contracts with no scope
 * metadata, which is how this was found.
 *
 * Selecting is unrestricted, so the prefix search happens in the read and the
 * delete names the exact ids it found. The error is checked now.
 */
async function cleanup() {
  // Requests first (they reference contracts), then invoices, then
  // contracts. FK on delete for some is SET NULL which is fine.
  for (const table of ['requests', 'invoices', 'contracts']) {
    const { data, error: readError } = await sb.from(table).select('id').like('id', `${PREFIX}%`);
    if (readError) throw new Error(`cleanup could not list ${table}: ${readError.message}`);
    const ids = (data ?? []).map((row) => row.id).filter(Boolean);
    if (ids.length === 0) continue;
    const { error } = await sb.from(table).delete().in('id', ids);
    if (error) throw new Error(`cleanup could not delete ${ids.length} ${table}: ${error.message}`);
  }
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
    // Relative to today: this was '2026-01-01', and once that date passed the
    // contract was — correctly — no longer active, so the fixture broke the
    // scenario rather than the view.
    end_date: dayFromToday(400),
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

async function scenarioContractStatusLive() {
  if (windowDays === null) { fail('derived: the renewal window is on the policy row', 'contractExpiryBufferDays missing'); return; }
  const supplier = await pickTestSupplier();
  const { data: before } = await sb
    .from('suppliers_with_derived').select('active_contracts_live').eq('id', supplier.id).single();
  const baseline = before?.active_contracts_live ?? 0;

  // Recorded status, end date — each read back through the view.
  const cases = [
    ['active', dayFromToday(-1), 'ended yesterday'],
    ['active', dayFromToday(0), 'ends today'],
    ['active', dayFromToday(windowDays), 'ends on the last day of the window'],
    ['active', dayFromToday(windowDays + 1), 'ends the day after the window'],
    ['expiring', dayFromToday(windowDays + 30), 'recorded expiring, far from its end'],
    ['terminated', dayFromToday(10), 'terminated early'],
    ['draft', dayFromToday(-5), 'a draft past its date'],
    ['active', 'not a date', 'no readable end date'],
  ];
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const ids = [];
  for (const [i, [status, endDate]] of cases.entries()) {
    const id = `${PREFIX}CON-ST-${i}-${stamp}`;
    ids.push(id);
    const { error } = await sb.from('contracts').insert({
      id, title: 'E2E contract status', supplier_id: supplier.id, supplier_name: supplier.name,
      value: 1000, start_date: '2025-01-01', end_date: endDate, status, owner_id: 'u1', owner_name: 'Test Owner',
      department: 'Test', category: 'Test', utilisation_percentage: 0,
    });
    if (error) { fail('derived: insert status fixture', error.message); return; }
  }
  const { data: rows, error } = await sb.from('contracts_with_derived').select('id, status, status_live').in('id', ids);
  if (error) { fail('derived: read status_live', error.message); return; }
  const byId = new Map((rows ?? []).map((r) => [r.id, r]));
  for (const [i, [status, endDate, label]] of cases.entries()) {
    const got = byId.get(ids[i]);
    const want = contractStatusOn(status, endDate, windowDays, today);
    assert(got?.status_live === want && got?.status === status,
      `derived: status from the end date — ${label}: ${want} (recorded ${status}, unchanged)`,
      `view ${got?.status_live}, rule ${want}, stored ${got?.status}`);
  }

  // In force: ends today, the window's last day, after it, the recorded
  // "expiring" far out, and the one with no readable date — five. Not the one
  // that ended yesterday, the terminated one or the draft.
  const { data: after } = await sb
    .from('suppliers_with_derived').select('active_contracts_live').eq('id', supplier.id).single();
  assert(after?.active_contracts_live === baseline + 5,
    'derived: a supplier\'s active contracts leave out the one past its end date',
    `before=${baseline} after=${after?.active_contracts_live}`);
}

async function main() {
  await cleanup();
  await scenarioActiveContractsLive();
  await scenarioContractStatusLive();
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
