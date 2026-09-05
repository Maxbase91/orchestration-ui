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
import { neon } from '@neondatabase/serverless';
import { loadEnv, requireConnection, skipIfUnreachable, skipLive } from '../lib/live.mjs';

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
     is_overdue, created_at, updated_at)
   VALUES ($1,$2,$3,'services','validation','medium',1000,'EUR',$4,$4,'procurement-led','CC-TEST',0,0,false,$5,$5)`,
  [requestId, `Workflow atomicity ${suffix}`, 'Automated workflow-action verification', owner.id, now],
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
