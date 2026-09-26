#!/usr/bin/env node
// A confirmed assistant action writes a real record, or says it cannot.
//
// api/execute-action.ts replied "Done — Approval delegate set to Anna" for nine
// action types and performed none of them. Its one write named a `source`
// column that audit_entries does not have, so it failed with SQLSTATE 42703 and
// the compatibility client swallowed the error into an unread { error } — a
// count of audit rows with object_type 'assistant' returned zero. The endpoint
// did nothing, recorded nothing, and said it was done.
//
// tests/integration/assistant-honesty.mjs already pinned this bug class on the
// MOCK path. This is the live path it missed, so the honesty check below reuses
// that suite's own guard against every message this endpoint can produce.
import { neon } from '@neondatabase/serverless';
import { loadEnv, purgeAuditEntries, requireConnection, skipIfUnreachable, skipLive } from '../lib/live.mjs';

loadEnv();
const connectionString = requireConnection('execute-action');
process.env.NEON_DATABASE_URL = connectionString;
const sql = neon(connectionString);

const { default: handler, planAction } = await import('../../api/execute-action.ts');
const { claimsWorkAlreadyDone } = await import('../../api/chat.ts');

function invoke(body, method = 'POST') {
  let statusCode = 200;
  let responseBody;
  const response = {
    status(code) { statusCode = code; return response; },
    json(value) { responseBody = value; return response; },
  };
  return Promise.resolve(handler({ method, body }, response))
    .then(() => ({ statusCode, body: responseBody }));
}
const replyOf = (result) => result.body?.turns?.[0]?.content ?? '';

let failures = 0;
const check = (label, fn) => {
  try { fn(); console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (error) { failures++; console.error(`  \x1b[31m✗\x1b[0m ${label} — ${error.message.split('\n')[0]}`); }
};

const ACTIONS = [
  'add_watcher', 'set_delegate', 'set_ooo', 'reassign_request',
  'request_risk_reassessment', 'request_contract_renewal', 'request_po_change',
  'raise_payment_escalation', 'approver_substitution',
];

console.log('\nEvery proposable action is planned, and only those');

for (const action of ACTIONS) {
  check(`${action} has a plan`, () => {
    if (!planAction(action, {})) throw new Error('no plan');
  });
}
check('an invented action type has none', () => {
  if (planAction('delete_everything', {})) throw new Error('planned an unknown action');
});

console.log('\nThe two with nowhere to write refuse, and refuse honestly');

for (const action of ['add_watcher', 'approver_substitution']) {
  const plan = planAction(action, {});
  check(`${action} is marked unavailable`, () => {
    if (plan.kind !== 'unavailable') throw new Error(`kind is ${plan.kind}`);
  });
  check(`${action} says nothing was recorded`, () => {
    if (!/recorded nothing|no watcher list/i.test(plan.message)) throw new Error(plan.message);
  });
  check(`${action} points at what does work`, () => {
    if (!/timeline|Delegate/i.test(plan.message)) throw new Error('no alternative offered');
  });
}

console.log('\nNo refusal message claims work was done');

// The guard assistant-honesty.mjs uses, turned on this endpoint's own strings.
for (const action of ACTIONS) {
  const plan = planAction(action, {});
  if (plan.kind !== 'unavailable') continue;
  check(`${action}'s message passes the honesty guard`, () => {
    if (claimsWorkAlreadyDone(plan.message)) throw new Error(plan.message);
  });
}

let users;
try {
  users = await sql.query('SELECT id, name FROM users ORDER BY id LIMIT 2');
} catch (error) {
  skipIfUnreachable('execute-action', error);
}
if (!users || users.length < 2) skipLive('execute-action', 'need two seeded users');

const suffix = Date.now().toString(36);
const requestId = `TEST-EXEC-${suffix}`;
const [actor, delegate] = users;
const created = { tickets: [], audits: [] };

async function cleanup() {
  // The audit log is append-only; the purge is how a suite removes its own rows.
  await purgeAuditEntries('user_id = $1', [actor.id + `-${suffix}`]);
  await sql.query('DELETE FROM stage_history WHERE request_id = $1', [requestId]);
  await purgeAuditEntries('object_id = $1 OR request_id = $1', [requestId]);
  for (const id of created.tickets) await purgeAuditEntries('object_id = $1', [id]);
  for (const id of created.tickets) await sql.query('DELETE FROM tickets WHERE id = $1', [id]);
  await sql.query('DELETE FROM requests WHERE id = $1', [requestId]);
}

await cleanup();
const now = new Date().toISOString();
await sql.query(
  `INSERT INTO requests (id, title, description, category, status, priority, value, currency,
     requestor_id, owner_id, buying_channel, cost_centre, refer_back_count, days_in_stage,
     is_overdue, created_at, updated_at)
   VALUES ($1,$2,$3,'services','validation','medium',1000,'EUR',$4,$4,'procurement-led','CC-TEST',0,0,false,$5,$5)`,
  [requestId, `Execute action ${suffix}`, 'Automated execute-action verification', actor.id, now],
);
await sql.query(
  'INSERT INTO stage_history (request_id, stage, entered_at, owner_id, action) VALUES ($1, $2, $3, $4, $5)',
  [requestId, 'validation', now, actor.id, 'submitted'],
);

try {
  console.log('\nA reassignment actually reassigns');

  const reassign = await invoke({
    actionType: 'reassign_request',
    actionParams: { requestId, ownerId: delegate.id },
    userId: actor.id, userName: actor.name,
  });
  check('it succeeds', () => {
    if (reassign.statusCode !== 200) throw new Error(`status ${reassign.statusCode}: ${JSON.stringify(reassign.body)}`);
  });
  const [owned] = await sql.query('SELECT owner_id FROM requests WHERE id = $1', [requestId]);
  check('the request owner really changed', () => {
    if (owned?.owner_id !== delegate.id) throw new Error(`owner is ${owned?.owner_id}`);
  });
  const openRows = await sql.query('SELECT stage FROM stage_history WHERE request_id = $1 AND completed_at IS NULL', [requestId]);
  check('exactly one stage row is left open', () => {
    if (openRows.length !== 1) throw new Error(`${openRows.length} open`);
  });
  const audits = await sql.query("SELECT action, object_type, detail FROM audit_entries WHERE request_id = $1", [requestId]);
  check('an audit row was actually written', () => {
    if (audits.length !== 1) throw new Error(`${audits.length} audit rows — the insert used to fail silently`);
    if (audits[0].action !== 'reassign_request') throw new Error(`action ${audits[0].action}`);
  });
  check('the reply names what happened', () => {
    if (!replyOf(reassign).includes(requestId)) throw new Error(replyOf(reassign));
  });

  console.log('\nA "request X" action raises a real ticket with an SLA');

  const [contract] = await sql.query('SELECT id FROM contracts ORDER BY id LIMIT 1');
  if (!contract) skipLive('execute-action', 'no seeded contract');
  const renewal = await invoke({
    actionType: 'request_contract_renewal',
    actionParams: { contractId: contract.id },
    userId: actor.id, userName: actor.name,
  });
  check('it succeeds', () => {
    if (renewal.statusCode !== 200) throw new Error(`status ${renewal.statusCode}: ${JSON.stringify(renewal.body)}`);
  });
  const ticketId = (replyOf(renewal).match(/TKT-\d+/) ?? [])[0];
  check('the reply names a real ticket id', () => {
    if (!ticketId) throw new Error(replyOf(renewal));
  });
  if (ticketId) created.tickets.push(ticketId);
  const [ticket] = ticketId ? await sql.query('SELECT id, due_at, source, category FROM tickets WHERE id = $1', [ticketId]) : [];
  check('the ticket exists', () => { if (!ticket) throw new Error('no ticket row'); });
  check('it carries an SLA due date', () => {
    if (!ticket?.due_at) throw new Error('due_at is null');
  });
  check('the reply states the upstream boundary', () => {
    if (!/Nothing has been sent/i.test(replyOf(renewal))) throw new Error(replyOf(renewal));
  });

  console.log('\nA delegate is set on the record the approval router reads');

  const delegated = await invoke({
    actionType: 'set_delegate',
    actionParams: { delegateId: delegate.id, delegateName: delegate.name },
    userId: actor.id, userName: actor.name,
  });
  check('it succeeds', () => {
    if (delegated.statusCode !== 200) throw new Error(`status ${delegated.statusCode}: ${JSON.stringify(delegated.body)}`);
  });
  const [me] = await sql.query('SELECT delegate_id FROM users WHERE id = $1', [actor.id]);
  check('users.delegate_id is set — the column the workflow engine reads', () => {
    if (me?.delegate_id !== delegate.id) throw new Error(`delegate_id is ${me?.delegate_id}`);
  });

  console.log('\nNothing is claimed for a subject that does not exist');

  const ghost = await invoke({
    actionType: 'request_po_change',
    actionParams: { poId: `PO-NOPE-${suffix}` },
    userId: actor.id, userName: actor.name,
  });
  check('a missing subject is a 404, not a cheerful success', () => {
    if (ghost.statusCode !== 404) throw new Error(`status ${ghost.statusCode}`);
    if (ghost.body?.code !== 'subject_not_found') throw new Error(`code ${ghost.body?.code}`);
  });
  check('it says nothing was recorded', () => {
    if (!/nothing was recorded/i.test(ghost.body?.error ?? '')) throw new Error(ghost.body?.error);
  });
  const ghostTickets = await sql.query("SELECT id FROM tickets WHERE summary LIKE $1", [`%PO-NOPE-${suffix}%`]);
  check('and really recorded nothing', () => {
    if (ghostTickets.length !== 0) throw new Error(`${ghostTickets.length} tickets created for a missing PO`);
  });

  console.log('\nAn unknown action is refused rather than narrated');

  const unknown = await invoke({ actionType: 'delete_everything', actionParams: {}, userId: actor.id, userName: actor.name });
  check('it returns 400 unsupported_action', () => {
    if (unknown.statusCode !== 400) throw new Error(`status ${unknown.statusCode}`);
    if (unknown.body?.code !== 'unsupported_action') throw new Error(`code ${unknown.body?.code}`);
  });

  console.log('\nA refusal writes no audit row');

  const before = await sql.query("SELECT count(*)::int AS n FROM audit_entries WHERE action = 'add_watcher'");
  const watcher = await invoke({ actionType: 'add_watcher', actionParams: { requestId }, userId: actor.id, userName: actor.name });
  const after = await sql.query("SELECT count(*)::int AS n FROM audit_entries WHERE action = 'add_watcher'");
  check('it answers rather than erroring', () => {
    if (watcher.statusCode !== 200) throw new Error(`status ${watcher.statusCode}`);
  });
  check('it audits nothing, because nothing happened', () => {
    if (after[0].n !== before[0].n) throw new Error(`audit rows grew ${before[0].n} -> ${after[0].n}`);
  });
  check('its reply does not claim work was done', () => {
    if (claimsWorkAlreadyDone(replyOf(watcher))) throw new Error(replyOf(watcher));
  });
} finally {
  await sql.query('UPDATE users SET delegate_id = NULL, is_ooo = false WHERE id = $1', [actor.id]);
  await cleanup();
}

if (failures > 0) {
  console.error(`\nexecute-action: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nExecute-action checks passed.');
