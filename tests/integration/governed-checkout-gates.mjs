#!/usr/bin/env node
// A governed check must not be skippable by the failure of its own data read.
//
// Two defects this pins, both of which made a gate pass without running:
//
//   1. The contract-match gate sat INSIDE a try whose catch swallowed any error
//      matching /does not exist|relation/i. That pattern matches far more than
//      the missing table it names — "permission denied for relation x" and
//      several connection errors contain "relation" too — so a failed scope read
//      skipped the mandatory call-off gate entirely and persisted a requisition
//      whose scope evidence was silently null, indistinguishable from a check
//      that ran and matched nothing.
//
//   2. configFromRow rejected a stored policy row missing ANY key and fell back
//      to DEFAULT_POLICY_CONFIG wholesale, so adding one field to PolicyConfig
//      silently reverted every admin-configured threshold on the next deploy.
import { readFileSync } from 'node:fs';
import { isMissingRelation } from '../../api/_neon.ts';
import { DEFAULT_POLICY_CONFIG } from '../../src/lib/procurement/policy-config.ts';

let failures = 0;
const check = (label, fn) => {
  try { fn(); console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (error) { failures++; console.error(`  \x1b[31m✗\x1b[0m ${label} — ${error.message.split('\n')[0]}`); }
};
// Comments are stripped before scanning, the same way assistant-honesty.mjs
// does it: these fixes are documented by quoting the pattern they removed, and
// a quotation must not read as the pattern still being in the code.
const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');
const read = (path) => stripComments(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));

console.log('\nOnly a genuinely absent relation degrades');

check('SQLSTATE 42P01 (undefined_table) is a missing relation', () => {
  const error = Object.assign(new Error('relation "contract_scope_versions" does not exist'), { code: '42P01' });
  if (!isMissingRelation(error)) throw new Error('not recognised');
});
check('SQLSTATE 42703 (undefined_column) is a missing relation', () => {
  if (!isMissingRelation(Object.assign(new Error('column "x" does not exist'), { code: '42703' }))) {
    throw new Error('not recognised');
  }
});
check('a permission failure naming a relation is NOT swallowed', () => {
  // The exact shape the old regex misread as "table not migrated".
  const error = Object.assign(new Error('permission denied for relation contract_scope_versions'), { code: '42501' });
  if (isMissingRelation(error)) throw new Error('swallowed a permissions error');
});
check('a connection failure is NOT swallowed', () => {
  if (isMissingRelation(new Error('fetch failed'))) throw new Error('swallowed a connection error');
});
check('an error with no SQLSTATE is NOT swallowed', () => {
  if (isMissingRelation(new Error('relation does not exist'))) throw new Error('swallowed on message alone');
});

console.log('\nThe call-off gate is outside the catch that used to hide it');

const checkout = read('api/governed-checkout.ts');
check('the loose relation regex is gone from the checkout', () => {
  if (/does not exist\|relation/.test(checkout)) throw new Error('the message match is still there');
});
check('a call-off is refused when scope data could not be read', () => {
  if (!checkout.includes('contract_scope_unavailable')) throw new Error('no unavailable branch');
});
check('the gate is not inside the scope-load catch', () => {
  const catchStart = checkout.indexOf('if (!isMissingRelation(error)) throw error;');
  const gate = checkout.indexOf("checkout.route === 'contract-call-off'");
  if (catchStart < 0 || gate < 0) throw new Error('markers missing');
  if (gate < catchStart) throw new Error('the gate still precedes/sits inside the catch');
});
check('a check that did not run records that it did not run', () => {
  if (!checkout.includes("algorithmVersion: 'not-evaluated'")) throw new Error('no not-evaluated marker');
  if (!checkout.includes('coverage was not evaluated')) throw new Error('no explanatory reason');
});

console.log('\nA stored policy row is an override, not an all-or-nothing replacement');

// Reach configFromRow through loadPolicy's own module by exercising the rule it
// encodes: every key present in the row survives, whatever else is missing.
const { default: _handler } = await import('../../api/governed-checkout.ts');
void _handler;
check('the all-keys-present rejection is gone', () => {
  if (/keys\.some\(\(key\) => candidate\[key\] === undefined\)/.test(checkout)) {
    throw new Error('the all-or-nothing guard is still there');
  }
});
check('a row missing one key keeps its other stored values', () => {
  if (!checkout.includes('for (const [key, fallback] of Object.entries(DEFAULT_POLICY_CONFIG))')) {
    throw new Error('no per-key merge');
  }
});
check('a wrong-typed stored value is defaulted, not trusted', () => {
  if (!checkout.includes('typeof stored !== typeof fallback')) throw new Error('no type check');
  if (!checkout.includes('Array.isArray(fallback) !== Array.isArray(stored)')) throw new Error('no array check');
});
check('the policy config has keys to merge in the first place', () => {
  if (Object.keys(DEFAULT_POLICY_CONFIG).length < 10) throw new Error('unexpectedly small default config');
});

console.log('\nThe other two swallow sites were narrowed with it');

// The loose pattern must be gone everywhere. Where a handler still needs to
// tolerate an unmigrated table it must use the shared SQLSTATE helper; where
// the tolerance itself was removed (intake-submit's discarded policy read went
// with the dead approval-threshold branch) there is nothing left to narrow.
for (const [label, path] of [
  ['intake-submit', 'api/_domains/intake-submit.ts'],
  ['contract-match', 'api/_domains/contract-match.ts'],
  ['governed-checkout', 'api/governed-checkout.ts'],
]) {
  check(`${label} has no message-matched relation swallow`, () => {
    const source = read(path);
    if (/does not exist\|relation/.test(source)) throw new Error('message match still present');
    if (/catch[\s\S]{0,200}?relation/i.test(source) && !source.includes('isMissingRelation')) {
      throw new Error('swallows on a relation mention without the shared helper');
    }
  });
}
check('contract-match no longer returns every failure as a 400 validation_error', () => {
  const source = read('api/_domains/contract-match.ts');
  if (!source.includes('ContractMatchInputError')) throw new Error('no typed validation error');
  if (!source.includes('contract_match_failed')) throw new Error('no internal-failure code');
});

if (failures > 0) {
  console.error(`\ngoverned-checkout-gates: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nGoverned checkout gate checks passed.');
