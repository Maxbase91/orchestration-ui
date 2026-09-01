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

console.log('');
if (failures) console.error(`FAILED: ${failures} check(s)`);
else console.log('All intake-evidence checks passed.');
process.exit(failures === 0 ? 0 : 1);
