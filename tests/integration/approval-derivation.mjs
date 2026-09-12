#!/usr/bin/env node
// Who may act on an approval, and why.
//
// Every functional role used to collapse to one of six switchable personas
// (approver-resolution.ts), so a step naming "Category Manager" resolved to the
// same person whatever was being bought. The reported symptom was the review
// screen naming Dr. Katrin Bauer as the approver while Anna Müller was the one
// who could press Approve — and the header button offered itself to any persona
// whenever a request sat in the approval stage, wrote nothing, and reported
// success anyway.
//
// Derivation now follows the records: the category's managers, the contract's
// owner, the cost centre's owner. Where several people hold a responsibility the
// step stays open to the role and the first to respond decides.
import assert from 'node:assert/strict';
import {
  deriveApprovals, canActOnApproval, withContractOwnerStep,
} from '../../src/lib/procurement/approval-derivation.ts';
import { loadEnv, requireConnection, skipIfUnreachable } from '../lib/live.mjs';

let failures = 0;
const check = (label, fn) => {
  try { fn(); console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (error) { failures++; console.error(`  \x1b[31m✗\x1b[0m ${label} — ${error.message.split('\n')[0]}`); }
};

const users = new Map([
  ['u1', { id: 'u1', name: 'Anna Müller' }],
  ['u3', { id: 'u3', name: 'Sarah Chen' }],
  ['u6', { id: 'u6', name: "James O'Brien", isOoo: true, delegateId: 'u2' }],
  ['u7', { id: 'u7', name: 'Dr. Katrin Bauer' }],
  ['u2', { id: 'u2', name: 'Thomas Weber' }],
]);
const base = { categoryManagerIds: [], contractOwnerId: null, costCentreOwnerName: null, usersById: users };
const step = (role, approverId) => ({ id: role, role, ...(approverId ? { approverId } : {}) });

console.log('\nA step resolves to a person when the records name one');

check('one category manager is named outright', () => {
  const [entry] = deriveApprovals([step('Category Manager')], { ...base, categoryManagerIds: ['u3'] });
  assert.equal(entry.assignmentMode, 'person');
  assert.equal(entry.approverId, 'u3');
  assert.equal(entry.approverName, 'Sarah Chen');
});
check('an admin-named approver wins over derivation', () => {
  const [entry] = deriveApprovals([step('Category Manager', 'u7')], { ...base, categoryManagerIds: ['u3'] });
  assert.equal(entry.approverId, 'u7');
});
check("a call-off resolves to the contract's owner", () => {
  const [entry] = deriveApprovals([step('Contract Owner')], { ...base, contractOwnerId: 'u3' });
  assert.equal(entry.approverId, 'u3');
});
check('a budget owner resolves from the cost centre owner by name', () => {
  const [entry] = deriveApprovals([step('Budget Owner')], { ...base, costCentreOwnerName: 'Thomas Weber' });
  assert.equal(entry.approverId, 'u2');
});

console.log('\nWhere several people hold it, the role holds it');

check('two category managers leave the step open to the role', () => {
  const [entry] = deriveApprovals([step('Category Manager')], { ...base, categoryManagerIds: ['u7', 'u1'] });
  assert.equal(entry.assignmentMode, 'role');
  assert.equal(entry.approverId, null);
  assert.match(entry.approverName, /Dr\. Katrin Bauer/);
  assert.match(entry.approverName, /Anna Müller/);
});
check('an empty cost-centre owner falls back rather than naming nobody', () => {
  // cost_centres.owner is empty on every seeded row; inventing a name here
  // would put a person against a decision nobody assigned them.
  const [entry] = deriveApprovals([step('Budget Owner')], { ...base, costCentreOwnerName: '' });
  assert.equal(entry.assignmentMode, 'role');
  assert.equal(entry.approverId, null);
});
check('an unknown named approver falls back to the role', () => {
  const [entry] = deriveApprovals([step('Finance', 'u404')], base);
  assert.equal(entry.assignmentMode, 'role');
});

console.log('\nDelegation is recorded, not substituted');

check('an out-of-office approver keeps the entry and gains a delegate', () => {
  const [entry] = deriveApprovals([step('Category Manager')], { ...base, categoryManagerIds: ['u6'] });
  assert.equal(entry.approverId, 'u6', 'the person asked is still on the entry');
  assert.equal(entry.delegatedTo, 'u2');
});
check('an approver who is present has no delegate', () => {
  const [entry] = deriveApprovals([step('Category Manager')], { ...base, categoryManagerIds: ['u1'] });
  assert.equal(entry.delegatedTo, null);
});

console.log('\nSteps keep their order, and a call-off asks its contract owner first');

check('step order follows the chain', () => {
  const entries = deriveApprovals([step('Budget Owner'), step('Category Manager'), step('Finance')], base);
  assert.deepEqual(entries.map((e) => e.stepOrder), [1, 2, 3]);
});
check('a call-off gains a contract-owner step at the front', () => {
  const steps = withContractOwnerStep([step('Finance')], 'contract-call-off');
  assert.equal(steps.length, 2);
  assert.equal(steps[0].role, 'Contract Owner');
});
check('other routes are untouched', () => {
  assert.equal(withContractOwnerStep([step('Finance')], 'catalogue').length, 1);
});
check('a chain that already asks the contract owner is not doubled', () => {
  assert.equal(withContractOwnerStep([step('Contract Owner')], 'contract-call-off').length, 1);
});

console.log('\nOnly the right person can act');

const anna = { id: 'u1', role: 'procurement-manager' };
const james = { id: 'u6', role: 'service-owner' };
check('a person-assigned entry belongs to that person', () => {
  const entry = { assignmentMode: 'person', approverId: 'u7', status: 'pending', role: 'Category Manager' };
  assert.equal(canActOnApproval(entry, anna), false, 'Anna is not Katrin');
});
check('their delegate can act for them', () => {
  const entry = { assignmentMode: 'person', approverId: 'u7', delegatedTo: 'u1', status: 'pending' };
  assert.equal(canActOnApproval(entry, anna), true);
});
check('a role-assigned entry belongs to any holder of the role', () => {
  const entry = { assignmentMode: 'role', role: 'Category Manager', status: 'pending' };
  assert.equal(canActOnApproval(entry, anna), true, 'Anna holds procurement-manager');
  assert.equal(canActOnApproval(entry, james), false, 'James does not');
});
check('an entry already decided cannot be acted on again', () => {
  const entry = { assignmentMode: 'role', role: 'Category Manager', status: 'approved' };
  assert.equal(canActOnApproval(entry, anna), false);
});
check('a role nobody is mapped to is actionable by nobody', () => {
  const entry = { assignmentMode: 'role', role: 'Astronaut', status: 'pending' };
  assert.equal(canActOnApproval(entry, anna), false);
});

console.log('\nEvery surface decides the same way');

const { readFileSync } = await import('node:fs');
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const read = (path) => stripComments(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));

const SURFACES = [
  ['request header', 'src/features/requests/request-detail/components/action-buttons.tsx'],
  ['approvals tab', 'src/features/requests/request-detail/tab-approvals.tsx'],
  ['approvals queue', 'src/features/approvals/components/approval-card.tsx'],
];
for (const [label, path] of SURFACES) {
  check(`${label} gates on canActOnApproval`, () => {
    assert.match(read(path), /canActOnApproval/, 'does not use the shared gate');
  });
}
check('the header no longer offers Approve on stage alone', () => {
  const source = read('src/features/requests/request-detail/components/action-buttons.tsx');
  assert.doesNotMatch(source, /const canApprove = isApprovalStage \|\|/,
    'any persona can still approve any request sitting in the approval stage');
});
for (const [label, path] of SURFACES.slice(1)) {
  check(`${label} records the decision through the shared path`, () => {
    assert.match(read(path), /recordApprovalDecision/, 'stamps the entry without advancing the request');
  });
}
check('a decision records who actually responded', () => {
  const source = read('src/lib/workflow/approval-decision.ts');
  assert.match(source, /decidedBy: actor\.id/);
  assert.match(source, /decidedByName: actor\.name/);
});
check('a decision writes to the timeline and the audit log', () => {
  const source = read('src/lib/workflow/approval-decision.ts');
  assert.match(source, /transitionStage/, 'nothing reaches stage history');
  assert.match(source, /createAuditEntry/, 'nothing reaches the audit log');
});
check('a rejection refers back rather than cancelling', () => {
  const source = read('src/lib/workflow/approval-decision.ts');
  assert.match(source, /toStage: 'intake'/);
  assert.match(source, /'referred-back'/);
});
check('a rejection must carry a reason', () => {
  assert.match(read('src/lib/workflow/approval-decision.ts'), /A rejection needs a reason/);
});

console.log('\nOne derivation, everywhere approvers are decided');

check('the engine no longer resolves approvers itself', () => {
  const engine = read('src/lib/workflow/engine.ts');
  assert.doesNotMatch(engine, /resolveApprover\(step\.role\)/,
    'a request entering approval through the engine gets the six-persona collapse back');
  assert.match(engine, /createApprovalsFor/, 'the engine does not use the shared derivation');
});
check('the engine does not substitute a delegate for the person asked', () => {
  const engine = read('src/lib/workflow/engine.ts');
  assert.doesNotMatch(engine, /approver_id: assigneeId/,
    'replacing approver_id with the delegate erases who was accountable');
});
check('a chain that resolves to nothing still leaves someone able to act', () => {
  const engine = read('src/lib/workflow/engine.ts');
  assert.match(engine, /assignment_mode: 'role'/, 'the fallback entry names a persona nobody may hold');
});
check('the review preview promises what the write path delivers', () => {
  const preview = read('src/features/requests/new-request/step-routing-preview.tsx');
  assert.doesNotMatch(preview, /resolveApprover/,
    'the preview resolves personas and dedupes them, so it under-reports the real chain');
  assert.match(preview, /useDerivedApprovers/);
});

console.log('\nAgainst the live directory');

loadEnv();
process.env.NEON_DATABASE_URL = requireConnection('approval-derivation');
const { neonClient } = await import('../lib/live.mjs');
const { loadApprovalSources, loadChainSteps } = await import('../../src/lib/db/approvals-core.ts');

let client;
try { client = await neonClient('approval-derivation'); }
catch (error) { skipIfUnreachable('approval-derivation', error); throw error; }

const steps = await loadChainSteps(client, 'chain-1');
check('a stored chain has steps', () => { assert.ok(steps.length > 0, 'chain-1 has no steps'); });

const sources = await loadApprovalSources(client, { requestId: 'X', category: 'consulting' });
check('the category has managers in the directory', () => {
  assert.ok(sources.categoryManagerIds.length > 0,
    'no category_managers rows — is the table allowlisted in api/db.ts?');
});
check('every derived approver is a real directory user', () => {
  for (const entry of deriveApprovals(steps, sources)) {
    if (entry.approverId) assert.ok(sources.usersById.has(entry.approverId), `${entry.approverId} is not a user`);
  }
});

if (failures > 0) { console.error(`\napproval-derivation: ${failures} check(s) failed.`); process.exit(1); }
console.log('\nApproval derivation checks passed.');
