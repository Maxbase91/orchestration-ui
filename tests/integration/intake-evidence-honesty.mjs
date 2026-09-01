#!/usr/bin/env node
// A request must never carry a compliance check it did not run.
//
// Simple-mode intake persisted, on every submission:
//   sraCheck: { status: 'pass', detail: 'Automated checks will continue…' }
//   duplicateCheck: { found: false, detail: 'No duplicate demand detected at intake.' }
// Neither check runs on that path. A reviewer opening the request saw a passed
// supplier-risk screen and a clean duplicate search as stored governance
// evidence — the most damaging failure available to this codebase, because
// unlike a crash it is invisible and it is believed.
//
// This is a source check rather than a behavioural one on purpose: the value is
// a literal in the submit payload, so the only way to be sure is to read it.

import { readFileSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url);
// Comments are stripped before scanning: a comment that quotes the old literal
// (explaining why it is gone) must not read as the literal still being there.
const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');
const read = (path) => stripComments(readFileSync(new URL(path, ROOT), 'utf8'));

const SIMPLE = read('src/features/requests/new-request/simple-new-request-page.tsx');
const EXPERT = read('src/features/requests/new-request/new-request-page.tsx');
const TYPES = read('src/data/request-compliance.ts');
const TAB = read('src/features/requests/request-detail/tab-compliance.tsx');
const PAYMENTS = read('src/features/purchasing/payment-tracker-page.tsx');

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures++;
};

console.log('\nThe record can express a check that did not run');
check("sraCheck has a 'not-run' status distinct from 'not-applicable'",
  /'not-run'/.test(TYPES) && /'not-applicable'/.test(TYPES));
check('duplicateCheck records whether a search was performed',
  /performed\?: boolean/.test(TYPES));

console.log('\nSimple intake claims nothing it did not do');
// The exact literals that were there before, named so a revert is unmistakable.
check("no hardcoded sraCheck status: 'pass'",
  !/sraCheck:\s*\{\s*status:\s*'pass'/.test(SIMPLE));
check('no hardcoded "No duplicate demand detected"',
  !/No duplicate demand detected/.test(SIMPLE));
check("the SRA check is recorded as not-run",
  /sraCheck:\s*\{\s*status:\s*'not-run'/.test(SIMPLE));
check('the duplicate check is recorded as not performed',
  /duplicateCheck:\s*\{[^}]*performed:\s*false/.test(SIMPLE));

console.log('\nExpert intake still derives its evidence from real evaluation');
// The opposite failure would be "fixing" Simple by making Expert lie too.
check('the SRA status comes from captured state, not a literal',
  /sraCheck:\s*\{\s*status:\s*formData\.sraStatus/.test(EXPERT));
check('the policy checks come from captured state',
  /policyChecks:\s*formData\.policyChecks/.test(EXPERT));

console.log('\nThe reviewer can see the difference');
check('a not-run SRA is not styled as a warning',
  /'not-run' \?/.test(TAB) || /status === 'not-run'/.test(TAB));
check('an unperformed duplicate search does not render as "No duplicates"',
  /performed === false/.test(TAB) && /Not checked/.test(TAB));

console.log('\nA simulated action says so where the user can see it');
// The disclaimer used to live only in a source header and a module README. The
// buttons write a real status and a real paidDate and move the "Paid" KPI, so a
// finance user had no way to tell this apart from a real payment release.
check('the screen carries an internal-tracker notice',
  /Internal tracker only/.test(PAYMENTS));
check('the notice says no upstream system is contacted',
  /no upstream payment or banking system is[\s\S]{0,20}contacted/.test(PAYMENTS));
check('the confirmation toasts say no payment was sent',
  (PAYMENTS.match(/no payment sent/g) ?? []).length >= 2);

console.log('\nOne route decides both the recorded channel and its copy');
// Three surfaces used to disagree: the recommendation card read the channel,
// while the review and confirmation screens read a route state that was never
// set to p-card or direct-po.
check('the compliance label is derived from the recorded channel',
  /ROUTE_COPY\[effectiveRoute\]/.test(SIMPLE) && /routeFromChannel\(channel\)/.test(SIMPLE));
check('the confirmation screen names the same path',
  /setRoute\(effectiveRoute\)/.test(SIMPLE));

console.log('');
if (failures) console.error(`FAILED: ${failures} check(s)`);
else console.log('All intake-evidence checks passed.');
process.exit(failures === 0 ? 0 : 1);
