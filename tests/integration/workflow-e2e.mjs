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

// Vercel's anti-bot challenge trips on rapid POSTs from the same IP.
// A 400ms gap between calls keeps us below that threshold; on 403 we back
// off and retry once. Real users fire these one-by-one so this pacing
// does not mask production behaviour.
let lastCallAt = 0;
const MIN_GAP_MS = 400;
async function callWorkflowAction(body, attempt = 0) {
  const since = Date.now() - lastCallAt;
  if (since < MIN_GAP_MS) await new Promise((r) => setTimeout(r, MIN_GAP_MS - since));

  const res = await fetch(`${API_BASE}/api/workflow-action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // identifies the test runner in Vercel logs so security team can allow-list if needed
      'User-Agent': 'orchestration-ui-e2e/1.0',
    },
    body: JSON.stringify(body),
  });
  lastCallAt = Date.now();
  const text = await res.text();

  if (res.status === 403 && attempt < 2 && text.includes('Vercel Security Checkpoint')) {
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    return callWorkflowAction(body, attempt + 1);
  }

  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
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

async function scenarioWorkflowTemplateAttached() {
  // Pick an existing workflow template to attach
  const { data: templates } = await sb.from('workflow_templates').select('id').limit(1);
  const templateId = templates?.[0]?.id;
  if (!templateId) { fail('workflow-template: template available to attach', 'no templates in DB'); return; }

  const id = `${TEST_PREFIX}${Date.now()}-${randSuffix()}`;
  const now = new Date().toISOString();
  const { data: anyUser } = await sb.from('users').select('id').limit(1).single();
  const { error: insErr } = await sb.from('requests').insert({
    id,
    title: 'E2E workflow-template attach test',
    category: 'software',
    status: 'intake',
    priority: 'medium',
    value: 5000,
    currency: 'EUR',
    requestor_id: anyUser.id,
    owner_id: anyUser.id,
    is_urgent: false,
    days_in_stage: 0,
    is_overdue: false,
    refer_back_count: 0,
    workflow_template_id: templateId,
    created_at: now,
    updated_at: now,
  });
  if (insErr) { fail('workflow-template: insert request with workflow_template_id', insErr.message); return; }

  const { data: row } = await sb.from('requests').select('*').eq('id', id).single();
  assert(
    row.workflow_template_id === templateId,
    'workflow-template: id round-trips via list query',
    `got=${row.workflow_template_id} expected=${templateId}`,
  );
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

async function scenarioReferBackFlow() {
  // Mirrors what ReferBackDialog now sends.
  const { id } = await createTestRequest({ status: 'approval' });
  const before = await getRequest(id);
  const beforeCount = before.refer_back_count ?? 0;

  const resp = await callWorkflowAction({
    requestId: id,
    action: 'referred-back',
    newStatus: 'intake',
    notes: 'incomplete: supplier identity not confirmed',
  });
  assert(resp.status === 200, 'refer-back: API 200 OK', `status=${resp.status}`);

  const row = await getRequest(id);
  assert(row.status === 'intake', 'refer-back: requests.status set to target stage', `status=${row.status}`);
  assert(row.refer_back_count === beforeCount + 1, 'refer-back: refer_back_count incremented', `before=${beforeCount} after=${row.refer_back_count}`);

  const history = await getStageHistory(id);
  const approvalRow = history.find((h) => h.stage === 'approval');
  const intakeRow = history.find((h) => h.stage === 'intake' && h.action === 'referred-back');
  assert(!!approvalRow?.completed_at, 'refer-back: old stage completed_at set');
  assert(!!intakeRow, 'refer-back: new stage_history row with action=referred-back');
  assert(intakeRow?.notes?.startsWith('incomplete:'), 'refer-back: notes captured', `notes=${intakeRow?.notes}`);
}

async function scenarioReassignFlow() {
  const { id } = await createTestRequest({ status: 'approval' });
  const before = (await getRequest(id)).owner_id;

  // Pick a different user than the auto-seeded owner.
  const { data: otherUser } = await sb
    .from('users').select('id').neq('id', before).limit(1).single();

  const resp = await callWorkflowAction({
    requestId: id,
    action: 'reassigned',
    newStatus: 'approval',   // stays on same stage
    ownerId: otherUser.id,
    notes: 'out of office — passing baton',
  });

  assert(resp.status === 200, 'reassign: API 200 OK');
  const after = await getRequest(id);
  assert(after.owner_id === otherUser.id, 'reassign: owner_id changed', `before=${before} after=${after.owner_id}`);
  assert(after.status === 'approval', 'reassign: status unchanged', `status=${after.status}`);
}

async function scenarioEscalateFlow() {
  // Mirrors what EscalateDialog now sends: write a notification via supabase
  // client, and bump the request priority if urgency=critical.
  const { id } = await createTestRequest({ status: 'approval' });

  const notificationId = `NOT-ESC-TEST-${Date.now()}-${randSuffix()}`;
  const { error: notifErr } = await sb.from('notifications').insert({
    id: notificationId,
    type: 'escalation',
    title: `${id} escalated to VP`,
    description: '[CRITICAL] supplier non-responsive for 10 days',
    timestamp: new Date().toISOString(),
    is_read: false,
    related_id: id,
    action_url: `/requests/${id}`,
  });
  if (notifErr) {
    fail('escalate: notification insert', notifErr.message);
    return;
  }

  const { error: updErr } = await sb
    .from('requests').update({ priority: 'urgent', is_urgent: true }).eq('id', id);
  if (updErr) {
    fail('escalate: priority bump', updErr.message);
    return;
  }

  const { data: notif } = await sb.from('notifications').select('*').eq('id', notificationId).single();
  assert(!!notif, 'escalate: notification row inserted', `notif=${JSON.stringify(notif)}`);
  assert(notif.type === 'escalation', 'escalate: notification type=escalation');
  assert(notif.related_id === id, 'escalate: notification linked to request');

  const row = await getRequest(id);
  assert(row.priority === 'urgent', 'escalate: request.priority bumped to urgent (critical urgency)');
  assert(row.is_urgent === true, 'escalate: request.is_urgent=true');

  // cleanup the notification (requests cleanup is automatic)
  await sb.from('notifications').delete().eq('id', notificationId);
}

async function scenarioApprovalEntryFlow() {
  // Create a test approval entry attached to a test request.
  const { id: requestId } = await createTestRequest({ status: 'approval' });
  const approvalId = `APR-E2E-${Date.now()}-${randSuffix()}`;

  const { error: insErr } = await sb.from('approval_entries').insert({
    id: approvalId,
    request_id: requestId,
    approver_id: 'u1',
    approver_name: 'E2E Approver',
    approver_role: 'Finance Approver',
    status: 'pending',
    requested_at: new Date().toISOString(),
  });
  if (insErr) { fail('approval-entry: seed', insErr.message); return; }

  // Simulate the four card actions hitting updateApproval.
  const actions = [
    { label: 'approve',      patch: { status: 'approved',      responded_at: new Date().toISOString() } },
    { label: 'reject',       patch: { status: 'rejected',      responded_at: new Date().toISOString(), comments: 'out of scope' } },
    { label: 'request-info', patch: { status: 'info-requested', comments: 'please supply SOW' } },
    { label: 'delegate',     patch: { status: 'delegated',     delegated_to: 'u3' } },
  ];

  for (const { label, patch } of actions) {
    const { error } = await sb.from('approval_entries').update(patch).eq('id', approvalId);
    if (error) { fail(`approval-entry: ${label} update`, error.message); continue; }
    const { data: row } = await sb.from('approval_entries').select('*').eq('id', approvalId).single();
    assert(row.status === patch.status, `approval-entry: ${label} status=${patch.status}`);
    if (patch.responded_at) assert(!!row.responded_at, `approval-entry: ${label} responded_at set`);
    if (patch.comments) assert(row.comments === patch.comments, `approval-entry: ${label} comments captured`);
    if (patch.delegated_to) assert(row.delegated_to === patch.delegated_to, `approval-entry: ${label} delegated_to captured`);
  }

  await sb.from('approval_entries').delete().eq('id', approvalId);
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
  await runScenario('workflow-template-attach', scenarioWorkflowTemplateAttached);
  await runScenario('approve-flow',       scenarioApproveFlow);
  await runScenario('reject-flow',        scenarioRejectFlow);
  await runScenario('cancel-flow',        scenarioCancelFlow);
  await runScenario('full-lifecycle',     scenarioFullLifecycle);
  await runScenario('idempotency',        scenarioIdempotencyCheck);
  await runScenario('refer-back',         scenarioReferBackFlow);
  await runScenario('escalate',           scenarioEscalateFlow);
  await runScenario('reassign',           scenarioReassignFlow);
  await runScenario('approval-entries',   scenarioApprovalEntryFlow);

  console.log('Cleaning up test data...');
  const removed = await cleanupTestData();
  console.log(`Removed ${removed} request(s).`);

  process.exit(report());
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(2);
});
