#!/usr/bin/env node
// Verifies the demand disposition — proceed / request-change / refer-back (RTE-06).
//
// Self-contained — mirrors src/lib/procurement/referral.ts. Keep in sync.
// Run: node tests/integration/referral.mjs

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

function determineReferral(i) {
  if (i.missingMandatory) return { outcome: 'refer-back' };
  if (i.outOfScope) return { outcome: 'refer-back' };
  if (i.failedPolicyChecks > 0) return { outcome: 'request-change' };
  if (i.duplicateDetected) return { outcome: 'request-change' };
  return { outcome: 'proceed' };
}

const clear = { missingMandatory: false, outOfScope: false, failedPolicyChecks: 0, duplicateDetected: false };
const o = (i) => determineReferral(i).outcome;

console.log('Proceed');
check('no issues → proceed', o(clear) === 'proceed');

console.log('Refer-back (most blocking)');
check('missing mandatory → refer-back', o({ ...clear, missingMandatory: true }) === 'refer-back');
check('out of scope → refer-back', o({ ...clear, outOfScope: true }) === 'refer-back');
check('missing mandatory outranks policy + duplicate', o({ missingMandatory: true, outOfScope: false, failedPolicyChecks: 3, duplicateDetected: true }) === 'refer-back');
check('out of scope outranks policy', o({ ...clear, outOfScope: true, failedPolicyChecks: 2 }) === 'refer-back');

console.log('Request-change');
check('failed policy checks → request-change', o({ ...clear, failedPolicyChecks: 1 }) === 'request-change');
check('duplicate → request-change', o({ ...clear, duplicateDetected: true }) === 'request-change');
check('policy failure outranks duplicate', determineReferral({ ...clear, failedPolicyChecks: 2, duplicateDetected: true }).outcome === 'request-change');
check('zero failed checks is not a change trigger', o({ ...clear, failedPolicyChecks: 0 }) === 'proceed');

console.log('');
if (failures) { console.error(`FAILED: ${failures} check(s)`); process.exitCode = 1; }
else console.log('All referral checks passed.');
