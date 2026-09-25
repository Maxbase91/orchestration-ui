#!/usr/bin/env node
// Verifies the demand disposition — proceed / request-change / refer-back (RTE-06).
//
// Imports the real module (it carried its own copy, "keep in sync").
// Run: npm run test:referral
import { readFileSync } from 'node:fs';
import { determineReferral } from '../../src/lib/procurement/referral.ts';

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

const clear = { missingMandatory: false, outOfScope: false, failedPolicyChecks: 0 };
const o = (i) => determineReferral(i).outcome;

console.log('Proceed');
check('no issues → proceed', o(clear) === 'proceed');

console.log('Refer-back (most blocking)');
check('missing mandatory → refer-back', o({ ...clear, missingMandatory: true }) === 'refer-back');
check('out of scope → refer-back', o({ ...clear, outOfScope: true }) === 'refer-back');
check('missing mandatory outranks policy', o({ missingMandatory: true, outOfScope: false, failedPolicyChecks: 3 }) === 'refer-back');
check('out of scope outranks policy', o({ ...clear, outOfScope: true, failedPolicyChecks: 2 }) === 'refer-back');
check('blocked supplier (screening) → refer-back', o({ ...clear, supplierBlocked: true }) === 'refer-back');
check('blocked supplier outranks policy', o({ ...clear, supplierBlocked: true, failedPolicyChecks: 2 }) === 'refer-back');

console.log('Request-change');
check('failed policy checks → request-change', o({ ...clear, failedPolicyChecks: 1 }) === 'request-change');
// A suspected duplicate was an input; nothing ever detected one, and it was
// retired (2026-09-25). A disposition must not depend on a check that never ran.
check('no duplicate input remains', !/duplicate/i.test(readFileSync('src/lib/procurement/referral.ts', 'utf8').replace(/\/\/.*$|\s\*.*$/gm, '')));
check('zero failed checks is not a change trigger', o({ ...clear, failedPolicyChecks: 0 }) === 'proceed');

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exitCode = 1; }
else console.log('All referral checks passed.');
