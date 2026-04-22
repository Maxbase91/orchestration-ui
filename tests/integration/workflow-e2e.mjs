#!/usr/bin/env node
// End-to-end integration test for procurement workflow flows.
//
// Exercises every user-facing button flow against the deployed Vercel API
// + live Supabase, then asserts the DB landed in the expected state.
//
// Run: `node tests/integration/workflow-e2e.mjs`
// Env: reads .env.local for SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and
//      optional E2E_API_BASE (defaults to the production Vercel deploy).
//
// The suite reports three outcomes per scenario:
//   PASS           — DB changed as expected after the API call
//   FAIL           — DB state diverged from the spec (real bug)
//   NOT_IMPLEMENTED— button is wired client-state-only today (no API call)
//
// Exit code is 0 only when there are zero FAILs. NOT_IMPLEMENTED is a
// reported gap, not a suite failure — it flags what Codex should review.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// ── env ────────────────────────────────────────────────────────────
function loadEnv() {
  const raw = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE = process.env.E2E_API_BASE ?? 'https://orchestration-ui-khaki.vercel.app';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(2);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ── result collector ───────────────────────────────────────────────
const results = [];
function pass(name, detail = '') { results.push({ name, outcome: 'PASS', detail }); }
function fail(name, detail) { results.push({ name, outcome: 'FAIL', detail }); }
function gap(name, detail)  { results.push({ name, outcome: 'NOT_IMPLEMENTED', detail }); }

function assert(cond, name, detail) {
  if (cond) pass(name, detail);
  else fail(name, detail);
  return cond;
}

// ── helpers ────────────────────────────────────────────────────────
const TEST_PREFIX = 'E2E-TEST-';
const randSuffix = () => Math.random().toString(36).slice(2, 8).toUpperCase();

async function createTestRequest(overrides = {}) {
  const id = `${TEST_PREFIX}${Date.now()}-${randSuffix()}`;
  const now = new Date().toISOString();

  // owner + requestor must reference existing users — pick the first one
  const { data: anyUser } = await sb.from('users').select('id').limit(1).single();
  const userId = overrides.userId ?? anyUser?.id;

  const row = {
    id,
    title: 'E2E Integration Test Request',
    description: 'Created by workflow-e2e.mjs; deleted at end of run.',
    category: 'goods',
    status: overrides.status ?? 'draft',
    priority: 'medium',
    value: 1000,
    currency: 'EUR',
    requestor_id: userId,
    owner_id: userId,
    is_urgent: false,
    days_in_stage: 0,
    is_overdue: false,
    refer_back_count: 0,
    created_at: now,
    updated_at: now,
  };

  const { error: insErr } = await sb.from('requests').insert(row);
  if (insErr) throw new Error(`insert request: ${insErr.message}`);

  // matching initial stage_history row
  const { error: shErr } = await sb.from('stage_history').insert({
    request_id: id,
    stage: row.status,
    entered_at: now,
    owner_id: userId,
    action: 'created',
  });
  if (shErr) throw new Error(`insert stage_history: ${shErr.message}`);

  return { id, userId };
}

async function cleanupTestData() {
  // cascade via FK: stage_history, comments, approval_entries, etc. are ON DELETE CASCADE
  const { data: rows } = await sb.from('requests').select('id').like('id', `${TEST_PREFIX}%`);
  if (!rows?.length) return 0;
  const ids = rows.map((r) => r.id);
  const { error } = await sb.from('requests').delete().in('id', ids);
  if (error) throw new Error(`cleanup: ${error.message}`);
  return ids.length;
}

async function callWorkflowAction(body) {
  const res = await fetch(`${API_BASE}/api/workflow-action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, body: json };
}

async function getRequest(id) {
  const { data, error } = await sb.from('requests').select('*').eq('id', id).single();
  if (error) throw new Error(`getRequest: ${error.message}`);
  return data;
}

async function getStageHistory(id) {
  const { data, error } = await sb.from('stage_history').select('*').eq('request_id', id).order('entered_at');
  if (error) throw new Error(`getStageHistory: ${error.message}`);
  return data ?? [];
}

// ── scenarios ──────────────────────────────────────────────────────
async function scenarioCreateRequest() {
  const { id } = await createTestRequest();
  const row = await getRequest(id);
  assert(row.id === id, 'create-request: row exists', `id=${id}`);
  assert(row.status === 'draft', 'create-request: initial status=draft', `status=${row.status}`);

  const history = await getStageHistory(id);
  assert(history.length === 1, 'create-request: one stage_history row', `count=${history.length}`);
  assert(history[0].stage === 'draft', 'create-request: stage_history stage=draft', `stage=${history[0].stage}`);
}

async function scenarioApproveFlow() {
  // Seed request directly in the approval stage (UI arrives here via
  // intake→validation→approval transitions; those use the same API, so
  // we short-circuit to the interesting step).
  const { id } = await createTestRequest({ status: 'approval' });

  const resp = await callWorkflowAction({
    requestId: id,
    action: 'approved',
    newStatus: 'sourcing',
  });
  assert(resp.status === 200, 'approve: API 200 OK', `status=${resp.status} body=${JSON.stringify(resp.body)}`);

  const row = await getRequest(id);
  assert(row.status === 'sourcing', 'approve: requests.status=sourcing', `status=${row.status}`);

  const history = await getStageHistory(id);
  const approvalRow = history.find((h) => h.stage === 'approval');
  const sourcingRow = history.find((h) => h.stage === 'sourcing');
  assert(!!approvalRow?.completed_at, 'approve: old approval row completed', `completed_at=${approvalRow?.completed_at}`);
  assert(!!sourcingRow, 'approve: new sourcing stage_history row exists', `sourcingRow=${JSON.stringify(sourcingRow)}`);
  assert(sourcingRow?.action === 'approved', 'approve: new row action=approved', `action=${sourcingRow?.action}`);
}

async function scenarioRejectFlow() {
  const { id } = await createTestRequest({ status: 'approval' });

  const resp = await callWorkflowAction({
    requestId: id,
    action: 'rejected',
    newStatus: 'cancelled',
  });
  assert(resp.status === 200, 'reject: API 200 OK', `status=${resp.status}`);

  const row = await getRequest(id);
  assert(row.status === 'cancelled', 'reject: requests.status=cancelled', `status=${row.status}`);

  const history = await getStageHistory(id);
  const approvalRow = history.find((h) => h.stage === 'approval');
  const cancelledRow = history.find((h) => h.stage === 'cancelled');
  assert(!!approvalRow?.completed_at, 'reject: old approval row completed');
  assert(!!cancelledRow, 'reject: new cancelled stage_history row exists');
  assert(cancelledRow?.action === 'rejected', 'reject: new row action=rejected', `action=${cancelledRow?.action}`);
}

async function scenarioCancelFlow() {
  const { id } = await createTestRequest({ status: 'intake' });

  const resp = await callWorkflowAction({
    requestId: id,
    action: 'cancelled',
    newStatus: 'cancelled',
  });
  assert(resp.status === 200, 'cancel: API 200 OK');

  const row = await getRequest(id);
  assert(row.status === 'cancelled', 'cancel: requests.status=cancelled', `status=${row.status}`);
}

async function scenarioFullLifecycle() {
  const { id } = await createTestRequest({ status: 'intake' });
  const transitions = [
    ['intake',       'validation',  'validated'],
    ['validation',   'approval',    'submitted'],
    ['approval',     'sourcing',    'approved'],
    ['sourcing',     'contracting', 'sourced'],
    ['contracting',  'po',          'contracted'],
    ['po',           'receipt',     'po-issued'],
    ['receipt',      'invoice',     'received'],
    ['invoice',      'payment',     'invoiced'],
    ['payment',      'completed',   'paid'],
  ];

  for (const [from, to, action] of transitions) {
    const resp = await callWorkflowAction({ requestId: id, action, newStatus: to });
    if (resp.status !== 200) {
      fail(`full-lifecycle: ${from}→${to}`, `HTTP ${resp.status} body=${JSON.stringify(resp.body)}`);
      return;
    }
  }

  const row = await getRequest(id);
  assert(row.status === 'completed', 'full-lifecycle: ends at completed', `status=${row.status}`);

  const history = await getStageHistory(id);
  assert(history.length >= 10, 'full-lifecycle: all stages recorded', `count=${history.length}`);
  const completedPending = history.filter((h) => h.stage !== 'completed' && !h.completed_at);
  assert(completedPending.length === 0, 'full-lifecycle: all non-terminal rows have completed_at', `pending=${completedPending.length}`);
}

async function scenarioReferBackGap() {
  // The ReferBackDialog UI collects reason/explanation then calls toast.success
  // — there is no /api/refer-back endpoint and no mutation wired to it.
  // Confirm the gap by asserting no such endpoint exists, and that clicking
  // the button would not mutate the DB.
  const probe = await fetch(`${API_BASE}/api/refer-back`, { method: 'POST' }).catch(() => null);
  gap(
    'refer-back',
    `ReferBackDialog (src/features/requests/request-detail/components/refer-back-dialog.tsx) ` +
    `invokes toast only; no endpoint. Probe of /api/refer-back → ${probe?.status ?? 'network-error'}. ` +
    `refer_back_count on requests never increments. Wire the dialog to a new endpoint + mutation.`,
  );
}

async function scenarioEscalateGap() {
  const probe = await fetch(`${API_BASE}/api/escalate`, { method: 'POST' }).catch(() => null);
  gap(
    'escalate',
    `EscalateDialog (escalate-dialog.tsx) is client-state-only. Probe of /api/escalate → ${probe?.status ?? 'network-error'}. ` +
    `No approval-chain rewrite, no notification row, no audit entry. Wire to endpoint that mutates approval_entries + notifications.`,
  );
}

async function scenarioReassignGap() {
  // Reassign changes the owner. The backend workflow-action DOES accept an
  // ownerId, but the ReassignDialog button does not call it today.
  const { id } = await createTestRequest({ status: 'approval' });
  const before = (await getRequest(id)).owner_id;

  // Simulate what a fixed UI would do:
  const resp = await callWorkflowAction({
    requestId: id,
    action: 'reassigned',
    newStatus: 'approval',       // same stage
    ownerId: 'u1',
    notes: 'E2E reassign simulation',
  });

  // The endpoint only writes stage_history if newStatus changes. Because
  // reassign keeps the stage, only the owner_id patch should persist.
  assert(resp.status === 200, 'reassign: API 200 OK (when called directly)');
  const after = await getRequest(id);
  assert(after.owner_id === 'u1', 'reassign: owner_id changed when API is called', `before=${before} after=${after.owner_id}`);

  gap(
    'reassign-ui-wiring',
    `ReassignDialog (reassign-dialog.tsx) does not call apiWorkflowAction. ` +
    `Backend accepts ownerId, so wiring is a 5-line fix: on submit, call ` +
    `apiWorkflowAction({ requestId, action: 'reassigned', newStatus: status, ownerId }). ` +
    `Verified the backend path works by calling it directly in this test.`,
  );
}

async function scenarioApprovalEntryGap() {
  gap(
    'approval-entry-actions',
    `ApprovalCard (src/features/approvals/approval-card.tsx) buttons (Approve, Reject, ` +
    `Delegate, Request Info) all fire toast only — approval_entries rows are never ` +
    `updated. This means the Approvals tab count does not decrement and audit trail is lost. ` +
    `Add a useUpdateApproval mutation (src/lib/db/hooks/use-approvals.ts already exports one) ` +
    `and wire the four button handlers to call it with status=approved/rejected/info-requested/delegated.`,
  );
}

async function scenarioIdempotencyCheck() {
  // Calling approve twice on the same request: second call should be a no-op
  // (status already sourcing, no new stage_history row).
  const { id } = await createTestRequest({ status: 'approval' });
  await callWorkflowAction({ requestId: id, action: 'approved', newStatus: 'sourcing' });
  const firstHistory = await getStageHistory(id);

  const dup = await callWorkflowAction({ requestId: id, action: 'approved', newStatus: 'sourcing' });
  assert(dup.status === 200, 'idempotency: duplicate approve returns 200');

  const secondHistory = await getStageHistory(id);
  assert(
    secondHistory.length === firstHistory.length,
    'idempotency: no duplicate stage_history row on same-status transition',
    `first=${firstHistory.length} second=${secondHistory.length}`,
  );
}

// ── runner ─────────────────────────────────────────────────────────
async function runScenario(name, fn) {
  try {
    await fn();
  } catch (err) {
    fail(`${name}: threw`, err instanceof Error ? `${err.message}\n${err.stack}` : String(err));
  }
}

function report() {
  const byOutcome = { PASS: 0, FAIL: 0, NOT_IMPLEMENTED: 0 };
  for (const r of results) byOutcome[r.outcome]++;

  console.log('');
  console.log('═'.repeat(72));
  console.log('  E2E WORKFLOW INTEGRATION TEST REPORT');
  console.log(`  API: ${API_BASE}`);
  console.log(`  DB:  ${SUPABASE_URL}`);
  console.log('═'.repeat(72));

  const colour = (o) => ({ PASS: '\x1b[32m', FAIL: '\x1b[31m', NOT_IMPLEMENTED: '\x1b[33m' }[o] + o + '\x1b[0m');
  for (const r of results) {
    console.log(`  ${colour(r.outcome).padEnd(25)} ${r.name}`);
    if (r.detail && (r.outcome === 'FAIL' || r.outcome === 'NOT_IMPLEMENTED')) {
      for (const line of r.detail.split('\n')) console.log(`      ${line}`);
    }
  }

  console.log('─'.repeat(72));
  console.log(`  PASS: ${byOutcome.PASS}   FAIL: ${byOutcome.FAIL}   NOT_IMPLEMENTED: ${byOutcome.NOT_IMPLEMENTED}`);
  console.log('═'.repeat(72));

  return byOutcome.FAIL === 0 ? 0 : 1;
}

async function main() {
  console.log(`Cleaning up leftover test data...`);
  const cleaned = await cleanupTestData();
  console.log(`Removed ${cleaned} stale test request(s).`);

  console.log('Running scenarios...');
  await runScenario('create-request',     scenarioCreateRequest);
  await runScenario('approve-flow',       scenarioApproveFlow);
  await runScenario('reject-flow',        scenarioRejectFlow);
  await runScenario('cancel-flow',        scenarioCancelFlow);
  await runScenario('full-lifecycle',     scenarioFullLifecycle);
  await runScenario('idempotency',        scenarioIdempotencyCheck);
  await runScenario('refer-back',         scenarioReferBackGap);
  await runScenario('escalate',           scenarioEscalateGap);
  await runScenario('reassign',           scenarioReassignGap);
  await runScenario('approval-entries',   scenarioApprovalEntryGap);

  console.log('Cleaning up test data...');
  const removed = await cleanupTestData();
  console.log(`Removed ${removed} request(s).`);

  process.exit(report());
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(2);
});
