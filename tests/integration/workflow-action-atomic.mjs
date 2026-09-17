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

async function cleanup() {
  await sql.query('DELETE FROM stage_history WHERE request_id = $1', [requestId]);
  await sql.query('DELETE FROM requests WHERE id = $1', [requestId]);
}

await cleanup();
const now = new Date().toISOString();
await sql.query(
  `INSERT INTO requests (id, title, description, category, status, priority, value, currency,
     requestor_id, owner_id, buying_channel, cost_centre, refer_back_count, days_in_stage,
     is_overdue, created_at, updated_at, workflow_template_id, sla_deadline)
   VALUES ($1,$2,$3,'services','validation','medium',1000,'EUR',$4,$4,'procurement-led','CC-TEST',0,0,false,$5,$5,'WF-001',$6)`,
  [requestId, `Workflow atomicity ${suffix}`, 'Automated workflow-action verification', owner.id, now, STALE_DEADLINE],
);
await sql.query(
  'INSERT INTO stage_history (request_id, stage, entered_at, owner_id, action) VALUES ($1, $2, $3, $4, $5)',
  [requestId, 'validation', now, owner.id, 'submitted'],
);

try {
  console.log('\nA stage transition commits the request and its history together');

  const advanced = await invoke({ requestId, action: 'advanced', newStatus: 'approval', notes: 'moving on' });
  check('the transition succeeds', () => {
    if (advanced.statusCode !== 200) throw new Error(`status ${advanced.statusCode}: ${JSON.stringify(advanced.body)}`);
  });

  const afterAdvance = await sql.query('SELECT status, days_in_stage FROM requests WHERE id = $1', [requestId]);
  check('the request moved to the new stage', () => {
    if (afterAdvance[0]?.status !== 'approval') throw new Error(`status is ${afterAdvance[0]?.status}`);
  });

  const history = await sql.query(
    'SELECT stage, action, completed_at FROM stage_history WHERE request_id = $1 ORDER BY entered_at',
    [requestId],
  );
  check('the previous stage was closed', () => {
    const previous = history.find((row) => row.stage === 'validation');
    if (!previous) throw new Error('no validation row');
    if (!previous.completed_at) throw new Error('validation row left open');
  });
  check('the new stage was recorded', () => {
    const entered = history.find((row) => row.stage === 'approval' && row.action === 'advanced');
    if (!entered) throw new Error(`no approval row in ${JSON.stringify(history)}`);
  });

  console.log('\nThe SLA clock belongs to the stage the request is in');

  // Read as TEXT, not as a Date. `requests.sla_deadline` is `timestamp` rather
  // than `timestamptz`, so the driver reconstructs it in the READING client's
  // local zone and hands back an instant shifted by that offset — an hour here,
  // five in New York. That is a real defect and a wide one (33 naive-timestamp
  // columns across 20 tables, all written as UTC ISO strings), but it is not
  // this commit's, and asserting through the shift would bake it in. The text
  // is what was stored, which is what "which node's SLA was read" needs.
  const afterAdvanceSla = await sql.query(
    'SELECT sla_deadline::text AS stored FROM requests WHERE id = $1', [requestId]);
  const advancedDeadline = afterAdvanceSla[0]?.stored;
  const storedMs = (text) => (text ? Date.parse(`${text.replace(' ', 'T')}Z`) : null);
  check('the previous stage\u2019s deadline does not survive the move', () => {
    if (storedMs(advancedDeadline) === Date.parse(STALE_DEADLINE)) {
      throw new Error('still the validation deadline');
    }
  });
  check('the new stage\u2019s own SLA was written', () => {
    // WF-001's Approval node allows 5 working days. Computed here from the same
    // helper the handler uses, so the assertion is about which NODE was read,
    // not a second implementation of business-day arithmetic.
    if (!advancedDeadline) throw new Error('no deadline written');
    const expected = addBusinessDays(new Date(), 5).getTime();
    // A minute of slack: the handler stamps its own `now`, a moment before this.
    if (Math.abs(storedMs(advancedDeadline) - expected) > 60_000) {
      throw new Error(`${advancedDeadline} is not ~5 working days out`);
    }
  });

  console.log('\nAn owner change is recorded even though the stage does not move');

  const reassigned = await invoke({
    requestId, action: 'reassigned', newStatus: 'approval', ownerId: delegate.id, notes: 'covering',
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
  const noop = await invoke({ requestId, action: 'advanced', newStatus: 'approval' });
  check('the no-op call succeeds', () => {
    if (noop.statusCode !== 200) throw new Error(`status ${noop.statusCode}`);
  });
  const [{ n: historyAfter }] = await sql.query(
    'SELECT count(*)::int AS n FROM stage_history WHERE request_id = $1', [requestId]);
  check('no history row is written for a handover that did not happen', () => {
    if (historyAfter !== historyBefore) throw new Error(`history grew ${historyBefore} -> ${historyAfter}`);
  });

  console.log('\nEvery action label the app actually sends is accepted');

  // Derived from the callers, not invented. An earlier guess at this vocabulary
  // omitted kanban-move and would have 422'd every drag on the board — the app
  // writes 25 distinct labels, so the handler validates types, not vocabulary.
  for (const [label, nextStatus] of [['kanban-move', 'sourcing'], ['reassigned', 'sourcing'], ['referred-back', 'validation']]) {
    const result = await invoke({ requestId, action: label, newStatus: nextStatus, ownerId: owner.id });
    check(`${label} is accepted`, () => {
      if (result.statusCode !== 200) throw new Error(`status ${result.statusCode}: ${JSON.stringify(result.body)}`);
    });
  }

  console.log('\nA stage with no SLA clears the clock rather than inheriting one');

  // WF-001's Completed node is an `end` node and sets no `slaDays`. Nothing is
  // due, so the honest value is NULL — and NULL is a value the handler must
  // WRITE. Leaving the column alone here is the original defect in its purest
  // form: a finished request with a live countdown.
  const completed = await invoke({ requestId, action: 'advanced', newStatus: 'completed' });
  check('the transition to a stage without an SLA succeeds', () => {
    if (completed.statusCode !== 200) throw new Error(`status ${completed.statusCode}`);
  });
  const afterCompleted = await sql.query('SELECT sla_deadline FROM requests WHERE id = $1', [requestId]);
  check('the deadline was cleared, not carried forward', () => {
    if (afterCompleted[0]?.sla_deadline != null) {
      throw new Error(`deadline is ${afterCompleted[0].sla_deadline}`);
    }
  });

  console.log('\nA rejected request changes nothing');

  const before = await sql.query('SELECT status FROM requests WHERE id = $1', [requestId]);
  const missing = await invoke({ requestId: `${requestId}-nope`, action: 'advanced', newStatus: 'sourcing' });
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
