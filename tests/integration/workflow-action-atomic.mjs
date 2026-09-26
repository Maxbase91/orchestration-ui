#!/usr/bin/env node
// Live Neon verification that a workflow stage transition is atomic and leaves
// an honest stage history behind.
//
// The handler used to run three independent statements and read none of their
// errors: the request status was committed first, and a failure in either
// stage_history write still returned 200. The request then sat in a stage with
// no record of how it got there. These checks pin the transaction, the
// owner-only (reassignment) case that the transition branch never covered, and
// the error shape — a raw SQL message used to be handed to the caller.
//
// It also pins the SLA clock. The handler changed `status` and left
// `sla_deadline` untouched, so a request carried the PREVIOUS stage's deadline
// forward: out of a 1-day Intake into a 20-day Sourcing and the countdown stayed
// on the intake deadline, went red overnight, and put the request in the Stuck
// and bottleneck views for the remaining nineteen days. The sentinel below is
// deliberately years in the past, so a deadline that survives a transition is
// unmistakable rather than merely a bit wrong.
import { neon } from '@neondatabase/serverless';
import { loadEnv, requireConnection, skipIfUnreachable, skipLive } from '../lib/live.mjs';
import { addBusinessDays } from '../../src/lib/workflow/business-days.ts';

loadEnv();
const connectionString = requireConnection('workflow-action-atomic');
process.env.NEON_DATABASE_URL = connectionString;
const sql = neon(connectionString);
const { default: handler } = await import('../../api/workflow-action.ts');

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

let failures = 0;
const check = (label, fn) => {
  try { fn(); console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (error) { failures++; console.error(`  \x1b[31m✗\x1b[0m ${label} — ${error.message.split('\n')[0]}`); }
};

let users;
try {
  users = await sql.query('SELECT id, name FROM users ORDER BY id LIMIT 2');
} catch (error) {
  skipIfUnreachable('workflow-action-atomic', error);
}
if (!users || users.length < 2) skipLive('workflow-action-atomic', 'need two seeded users');

const suffix = Date.now().toString(36);
const requestId = `TEST-WFA-${suffix}`;
// A deadline from a stage the request will have left. If a transition carries
// it forward, every assertion below names the year 2020.
const STALE_DEADLINE = '2020-01-01T00:00:00.000Z';
const [owner, delegate] = users;

// A second request for Cancel, which closes it for good.
const cancelId = `TEST-WFC-${suffix}`;

async function cleanup() {
  for (const id of [requestId, cancelId]) {
    await sql.query('DELETE FROM approval_entries WHERE request_id = $1', [id]);
    await sql.query('DELETE FROM workflow_instances WHERE request_id = $1', [id]);
    await sql.query('DELETE FROM stage_history WHERE request_id = $1', [id]);
    await sql.query('DELETE FROM requests WHERE id = $1', [id]);
  }
}

await cleanup();
const now = new Date().toISOString();
await sql.query(
  `INSERT INTO requests (id, title, description, category, status, priority, value, currency,
     requestor_id, owner_id, buying_channel, cost_centre, refer_back_count, days_in_stage,
     is_overdue, created_at, updated_at, workflow_template_id, sla_deadline)
   VALUES ($1,$2,$3,'services','approval','medium',1000,'EUR',$4,$4,'procurement-led','CC-TEST',0,0,false,$5,$5,'WF-001',$6)`,
  [requestId, `Workflow atomicity ${suffix}`, 'Automated workflow-action verification', owner.id, now, STALE_DEADLINE],
);
await sql.query(
  'INSERT INTO stage_history (request_id, stage, entered_at, owner_id, action) VALUES ($1, $2, $3, $4, $5)',
  [requestId, 'approval', now, owner.id, 'advanced'],
);

try {
  console.log('\nA refer-back commits the request and its history together');

  const referred = await invoke({ requestId, action: 'referred-back', newStatus: 'validation', notes: 'incomplete: missing cost centre' });
  check('the refer-back succeeds', () => {
    if (referred.statusCode !== 200) throw new Error(`status ${referred.statusCode}: ${JSON.stringify(referred.body)}`);
  });

  const afterReferral = await sql.query('SELECT status, days_in_stage, refer_back_count FROM requests WHERE id = $1', [requestId]);
  check('the request moved back to the earlier stage', () => {
    if (afterReferral[0]?.status !== 'validation') throw new Error(`status is ${afterReferral[0]?.status}`);
  });
  check('the refer-back count went up', () => {
    if (Number(afterReferral[0]?.refer_back_count) !== 1) throw new Error(`count is ${afterReferral[0]?.refer_back_count}`);
  });

  const history = await sql.query(
    'SELECT stage, action, completed_at FROM stage_history WHERE request_id = $1 ORDER BY entered_at',
    [requestId],
  );
  check('the previous stage was closed', () => {
    const previous = history.find((row) => row.stage === 'approval');
    if (!previous) throw new Error('no approval row');
    if (!previous.completed_at) throw new Error('approval row left open');
  });
  check('the new stage was recorded', () => {
    const entered = history.find((row) => row.stage === 'validation' && row.action === 'referred-back');
    if (!entered) throw new Error(`no validation row in ${JSON.stringify(history)}`);
  });

  console.log('\nThe SLA clock belongs to the stage the request is in');

  // Read as TEXT, not as a Date. `requests.sla_deadline` is `timestamp` rather
  // than `timestamptz`, so the driver reconstructs it in the READING client's
  // local zone and hands back an instant shifted by that offset — an hour here,
  // five in New York. That is a real defect and a wide one (33 naive-timestamp
  // columns across 20 tables, all written as UTC ISO strings), but it is not
  // this suite's, and asserting through the shift would bake it in. The text
  // is what was stored, which is what "which node's SLA was read" needs.
  const afterReferralSla = await sql.query(
    'SELECT sla_deadline::text AS stored FROM requests WHERE id = $1', [requestId]);
  const referredDeadline = afterReferralSla[0]?.stored;
  const storedMs = (text) => (text ? Date.parse(`${text.replace(' ', 'T')}Z`) : null);
  check('the previous stage’s deadline does not survive the move', () => {
    if (storedMs(referredDeadline) === Date.parse(STALE_DEADLINE)) {
      throw new Error('still the approval deadline');
    }
  });
  check('the new stage’s own SLA was written', () => {
    // WF-001's Validation node allows 3 working days. Computed here from the
    // same helper the handler uses, so the assertion is about which NODE was
    // read, not a second implementation of business-day arithmetic.
    if (!referredDeadline) throw new Error('no deadline written');
    const expected = addBusinessDays(new Date(), 3).getTime();
    // A minute of slack: the handler stamps its own `now`, a moment before this.
    if (Math.abs(storedMs(referredDeadline) - expected) > 60_000) {
      throw new Error(`${referredDeadline} is not ~3 working days out`);
    }
  });

  console.log('\nAn owner change is recorded even though the stage does not move');

  const reassigned = await invoke({
    requestId, action: 'reassigned', newStatus: 'validation', ownerId: delegate.id, notes: 'covering',
  });
  check('the reassignment succeeds', () => {
    if (reassigned.statusCode !== 200) throw new Error(`status ${reassigned.statusCode}`);
  });
  const afterReassign = await sql.query('SELECT owner_id FROM requests WHERE id = $1', [requestId]);
  check('the owner changed', () => {
    if (afterReassign[0]?.owner_id !== delegate.id) throw new Error(`owner is ${afterReassign[0]?.owner_id}`);
  });
  const reassignRows = await sql.query(
    "SELECT stage, owner_id FROM stage_history WHERE request_id = $1 AND action = 'reassigned'",
    [requestId],
  );
  check('the reassignment left a history entry', () => {
    if (reassignRows.length !== 1) throw new Error(`${reassignRows.length} reassigned rows`);
    if (reassignRows[0].owner_id !== delegate.id) throw new Error('history names the wrong owner');
  });

  console.log('\nThe stage history never has two rows open at once');

  const openRows = await sql.query(
    'SELECT stage FROM stage_history WHERE request_id = $1 AND completed_at IS NULL',
    [requestId],
  );
  check('exactly one stage row is open after the reassignment', () => {
    if (openRows.length !== 1) throw new Error(`${openRows.length} open: ${JSON.stringify(openRows)}`);
  });

  console.log('\nA call that changes nothing records nothing');

  const [{ n: historyBefore }] = await sql.query(
    'SELECT count(*)::int AS n FROM stage_history WHERE request_id = $1', [requestId]);
  const noop = await invoke({ requestId, action: 'reassigned', newStatus: 'validation', ownerId: delegate.id });
  check('the no-op call succeeds', () => {
    if (noop.statusCode !== 200) throw new Error(`status ${noop.statusCode}`);
  });
  const [{ n: historyAfter }] = await sql.query(
    'SELECT count(*)::int AS n FROM stage_history WHERE request_id = $1', [requestId]);
  check('no history row is written for a handover that did not happen', () => {
    if (historyAfter !== historyBefore) throw new Error(`history grew ${historyBefore} -> ${historyAfter}`);
  });

  console.log('\nOnly the three moves the request page makes are accepted');

  // The Active Workflows board sent `kanban-move` to any stage, and the handler
  // took any label: a drop moved a request past its gates, blocking forms,
  // onboarding checks and approvals (2026-09-26). The board is view-only now,
  // and a stage exit belongs to the request's stage action.
  for (const label of ['kanban-move', 'advanced', 'approved']) {
    const refused = await invoke({ requestId, action: label, newStatus: 'sourcing' });
    check(`"${label}" is refused`, () => {
      if (refused.statusCode !== 400) throw new Error(`status ${refused.statusCode}`);
      if (refused.body?.code !== 'unsupported_action') throw new Error(`code ${refused.body?.code}`);
    });
  }
  const forward = await invoke({ requestId, action: 'referred-back', newStatus: 'sourcing', notes: 'not back at all' });
  check('a "refer-back" to a later stage is refused', () => {
    if (forward.statusCode !== 400) throw new Error(`status ${forward.statusCode}`);
    if (forward.body?.code !== 'invalid_move') throw new Error(`code ${forward.body?.code}`);
  });
  const movingReassign = await invoke({ requestId, action: 'reassigned', newStatus: 'approval', ownerId: owner.id });
  check('a "reassignment" that changes the stage is refused', () => {
    if (movingReassign.statusCode !== 400) throw new Error(`status ${movingReassign.statusCode}`);
    if (movingReassign.body?.code !== 'invalid_move') throw new Error(`code ${movingReassign.body?.code}`);
  });
  const sneakCancel = await invoke({ requestId, action: 'referred-back', newStatus: 'cancelled', notes: 'x' });
  check('only Cancel reaches cancelled', () => {
    if (sneakCancel.statusCode !== 400) throw new Error(`status ${sneakCancel.statusCode}`);
  });
  const [afterRefusals] = await sql.query('SELECT status FROM requests WHERE id = $1', [requestId]);
  check('none of them moved the request', () => {
    if (afterRefusals?.status !== 'validation') throw new Error(`status is ${afterRefusals?.status}`);
  });

  console.log('\nA rejected request changes nothing');

  const before = await sql.query('SELECT status FROM requests WHERE id = $1', [requestId]);
  const missing = await invoke({ requestId: `${requestId}-nope`, action: 'reassigned', newStatus: 'validation', ownerId: owner.id });
  check('an unknown request is a 404, not a 500', () => {
    if (missing.statusCode !== 404) throw new Error(`status ${missing.statusCode}`);
    if (missing.body?.code !== 'request_not_found') throw new Error(`code ${missing.body?.code}`);
  });

  const incomplete = await invoke({ requestId });
  check('a payload missing newStatus is refused', () => {
    if (incomplete.statusCode !== 400) throw new Error(`status ${incomplete.statusCode}`);
    if (incomplete.body?.code !== 'validation_error') throw new Error(`code ${incomplete.body?.code}`);
  });

  const unchanged = await sql.query('SELECT status FROM requests WHERE id = $1', [requestId]);
  check('none of the refusals moved the request', () => {
    if (unchanged[0]?.status !== before[0]?.status) throw new Error('status changed on a refused call');
  });

  console.log('\nCancel stops the request, and everything waiting on it');

  // Cancel used to hand 'cancelled' to the workflow engine, which had no branch
  // for it: with an instance the request moved ON to its next stage, without
  // one nothing happened — and the page said "Request cancelled" either way.
  await sql.query(
    `INSERT INTO requests (id, title, description, category, status, priority, value, currency,
       requestor_id, owner_id, buying_channel, cost_centre, refer_back_count, days_in_stage,
       is_overdue, created_at, updated_at, workflow_template_id, sla_deadline)
     VALUES ($1,$2,$3,'services','approval','medium',1000,'EUR',$4,$4,'procurement-led','CC-TEST',0,0,false,$5,$5,'WF-001',$6)`,
    [cancelId, `Workflow cancel ${suffix}`, 'Automated cancel verification', owner.id, now, STALE_DEADLINE],
  );
  await sql.query(
    'INSERT INTO stage_history (request_id, stage, entered_at, owner_id, action) VALUES ($1, $2, $3, $4, $5)',
    [cancelId, 'approval', now, owner.id, 'advanced'],
  );
  await sql.query(
    `INSERT INTO approval_entries (id, request_id, approver_id, approver_name, approver_role, status, requested_at)
     VALUES ($1, $2, $3, $4, 'Approver', 'approved', $5), ($6, $2, $3, $4, 'Approver', 'pending', $5),
            ($7, $2, $3, $4, 'Approver', 'info-requested', $5)`,
    [`APR-${cancelId}-1`, cancelId, delegate.id, delegate.name, now, `APR-${cancelId}-2`, `APR-${cancelId}-3`],
  );
  await sql.query(
    `INSERT INTO workflow_instances (request_id, template_id, current_node_ids, status)
     VALUES ($1, 'WF-001', '["n5"]'::jsonb, 'suspended')`,
    [cancelId],
  );

  const noReason = await invoke({ requestId: cancelId, action: 'cancelled', newStatus: 'cancelled' });
  check('a cancellation without a reason is refused', () => {
    if (noReason.statusCode !== 400) throw new Error(`status ${noReason.statusCode}`);
    if (noReason.body?.code !== 'reason_required') throw new Error(`code ${noReason.body?.code}`);
  });

  const cancelled = await invoke({ requestId: cancelId, action: 'cancelled', newStatus: 'cancelled', notes: 'Covered by an existing contract' });
  check('the cancellation succeeds', () => {
    if (cancelled.statusCode !== 200) throw new Error(`status ${cancelled.statusCode}: ${JSON.stringify(cancelled.body)}`);
  });
  const [afterCancel] = await sql.query('SELECT status, sla_deadline FROM requests WHERE id = $1', [cancelId]);
  check('the request is cancelled — not moved on to its next stage', () => {
    if (afterCancel?.status !== 'cancelled') throw new Error(`status is ${afterCancel?.status}`);
  });
  check('a cancelled request has no deadline', () => {
    if (afterCancel?.sla_deadline != null) throw new Error(`deadline is ${afterCancel.sla_deadline}`);
  });
  const cancelHistory = await sql.query(
    "SELECT notes, completed_at FROM stage_history WHERE request_id = $1 AND stage = 'cancelled'", [cancelId]);
  check('the reason is in the history, on the cancelled stage', () => {
    if (cancelHistory[0]?.notes !== 'Covered by an existing contract') throw new Error(JSON.stringify(cancelHistory));
  });
  const approvalsAfter = await sql.query(
    'SELECT id, status, responded_at FROM approval_entries WHERE request_id = $1 ORDER BY id', [cancelId]);
  check('undecided approvals are withdrawn, and leave every queue', () => {
    const byId = Object.fromEntries(approvalsAfter.map((a) => [a.id, a]));
    if (byId[`APR-${cancelId}-2`]?.status !== 'withdrawn') throw new Error(`pending → ${byId[`APR-${cancelId}-2`]?.status}`);
    if (byId[`APR-${cancelId}-3`]?.status !== 'withdrawn') throw new Error(`info-requested → ${byId[`APR-${cancelId}-3`]?.status}`);
    if (!byId[`APR-${cancelId}-2`]?.responded_at) throw new Error('no time recorded');
  });
  check('a decided approval keeps its decision', () => {
    if (approvalsAfter.find((a) => a.id === `APR-${cancelId}-1`)?.status !== 'approved') throw new Error('the approval was rewritten');
  });
  const [instance] = await sql.query('SELECT status, current_node_ids FROM workflow_instances WHERE request_id = $1', [cancelId]);
  check('the workflow instance stops, so the engine never advances it', () => {
    if (instance?.status !== 'cancelled') throw new Error(`instance is ${instance?.status}`);
    if ((instance?.current_node_ids ?? []).length !== 0) throw new Error('still on a node');
  });

  const moved = await invoke({ requestId: cancelId, action: 'referred-back', newStatus: 'intake', notes: 'reopen' });
  check('a cancelled request cannot be moved again', () => {
    if (moved.statusCode !== 409) throw new Error(`status ${moved.statusCode}`);
    if (moved.body?.code !== 'request_closed') throw new Error(`code ${moved.body?.code}`);
  });
  const [stillCancelled] = await sql.query('SELECT status FROM requests WHERE id = $1', [cancelId]);
  check('…and is still cancelled', () => {
    if (stillCancelled?.status !== 'cancelled') throw new Error(`status is ${stillCancelled?.status}`);
  });

  console.log('\nErrors do not leak the database');

  const notAllowed = await invoke({ requestId }, 'GET');
  check('a wrong method returns the house error shape', () => {
    if (notAllowed.statusCode !== 405) throw new Error(`status ${notAllowed.statusCode}`);
    if (notAllowed.body?.code !== 'method_not_allowed') throw new Error(`code ${notAllowed.body?.code}`);
  });
  check('no response carries raw SQL text', () => {
    for (const result of [missing, incomplete, notAllowed]) {
      const text = JSON.stringify(result.body ?? {});
      if (/relation|column|constraint|syntax error/i.test(text)) throw new Error(`leaked: ${text}`);
    }
  });
} finally {
  await cleanup();
}

if (failures > 0) {
  console.error(`\nworkflow-action-atomic: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nWorkflow action atomicity checks passed.');
