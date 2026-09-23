#!/usr/bin/env node
// "Mine" has one definition, and every surface uses it.
//
// Three screens answered "what is on my plate" and no two agreed. The approvals
// queue counted an approval as mine when `approverId` matched *or* it was
// delegated to me. `/tasks/my-tasks` checked `approverId` alone — so an
// approver covering for someone out of office saw the approval in one place and
// not the other, and the task list they work from was the one that was wrong.
// The dashboard's attention band would have been a fourth.
//
// Two jobs: the functions behave, and nobody writes a fifth copy. The scan is
// the half that matters over time — the behaviour can be re-derived from a
// reading, a re-implementation somewhere else cannot.
//
// Run: npm run test:personal-queue

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import {
  approvalsAwaiting, isMyApproval, overdueOnMyPlate, referredBackToMe,
} from '../../src/lib/procurement/personal-queue.ts';

const ROOT = new URL('../../', import.meta.url);
let failures = 0;
const ok = (l) => console.log(`  \x1b[32m✓\x1b[0m ${l}`);
const bad = (l, d) => { failures += 1; console.error(`  \x1b[31m✗\x1b[0m ${l}`); if (d) console.error(`      ${d}`); };
const check = (label, fn) => { try { fn(); ok(label); } catch (e) { bad(label, e.message); } };

const approvals = [
  { id: 'a1', approverId: 'u1', status: 'pending' },
  { id: 'a2', approverId: 'u2', status: 'pending' },
  // The case the two surfaces disagreed on.
  { id: 'a3', approverId: 'u2', delegatedTo: 'u1', status: 'pending' },
  { id: 'a4', approverId: 'u1', status: 'approved' },
];

console.log('An approval is mine when it is assigned to me OR delegated to me');
check('the one assigned to me', () => assert.equal(isMyApproval(approvals[0], 'u1'), true));
check('the one assigned to someone else', () => assert.equal(isMyApproval(approvals[1], 'u1'), false));
check('the one delegated to me', () => assert.equal(isMyApproval(approvals[2], 'u1'), true));
check('awaiting excludes the decided one', () =>
  assert.deepEqual(approvalsAwaiting(approvals, 'u1').map((a) => a.id), ['a1', 'a3']));

const requests = [
  { id: 'r1', status: 'referred-back', requestorId: 'u1', ownerId: 'u9', isOverdue: false },
  // Referred back, but I am the OWNER — waiting on the requester, not on me.
  { id: 'r2', status: 'referred-back', requestorId: 'u9', ownerId: 'u1', isOverdue: false },
  { id: 'r3', status: 'sourcing', requestorId: 'u9', ownerId: 'u1', isOverdue: true },
  { id: 'r4', status: 'sourcing', requestorId: 'u1', ownerId: 'u9', isOverdue: true },
  { id: 'r5', status: 'sourcing', requestorId: 'u9', ownerId: 'u9', isOverdue: true },
];

console.log('\nRequests: referred-back is the requester’s, overdue is both parties’');
check('only the one sent back to me', () =>
  assert.deepEqual(referredBackToMe(requests, 'u1').map((r) => r.id), ['r1']));
check('overdue as owner and as requester, not a stranger’s', () =>
  assert.deepEqual(overdueOnMyPlate(requests, 'u1').map((r) => r.id), ['r3', 'r4']));

// ── Nobody writes a fifth copy ─────────────────────────────────────────────
//
// The comparison, not the field: `approverId` appears legitimately all over the
// tree (rendering a name, filtering a chain). What may not reappear is the
// ownership TEST — an equality against the current user — outside this module.
console.log('\nNo other module decides on its own whether an approval is mine');
const OWNED_BY = /(?:approverId|delegatedTo)\s*===\s*(?:currentUser\.id|userId|user\.id|currentUserId)/;
const HOME = 'src/lib/procurement/personal-queue.ts';

function sources(dir, out = []) {
  for (const entry of readdirSync(new URL(dir, ROOT))) {
    const rel = `${dir}${entry}`;
    if (statSync(new URL(rel, ROOT)).isDirectory()) sources(`${rel}/`, out);
    else if (/\.tsx?$/.test(entry)) out.push(rel);
  }
  return out;
}

const offenders = sources('src/')
  .filter((file) => file !== HOME)
  .filter((file) => OWNED_BY.test(readFileSync(new URL(file, ROOT), 'utf8')));

if (offenders.length) {
  bad(`${offenders.length} module(s) test approval ownership themselves`,
    `${offenders.join(', ')} — use isMyApproval/approvalsAwaiting from ${HOME}`);
} else {
  ok(`ownership is decided in ${HOME} alone`);
}

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exit(1); }
console.log('One definition of what is on your plate.');
