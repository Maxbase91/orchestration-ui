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

// Driven, not grepped. These three asserted the SHAPE of the merge by searching
// governed-checkout.ts for its source lines, so moving the loader to
// api/_policy.ts — where generate-sow and chat-intake can share it — broke the
// test while the behaviour was untouched. `configFromRow` is exported, so the
// rule can be exercised instead of described.
const { configFromRow } = await import('../../api/_policy.ts');
const NUMERIC_KEY = Object.keys(DEFAULT_POLICY_CONFIG)
  .find((k) => typeof DEFAULT_POLICY_CONFIG[k] === 'number');
const OTHER_KEY = Object.keys(DEFAULT_POLICY_CONFIG)
  .find((k) => k !== NUMERIC_KEY && typeof DEFAULT_POLICY_CONFIG[k] === 'number');

check('a row missing one key keeps its other stored values', () => {
  // The all-or-nothing guard rejected the whole row if any single key was
  // absent, so adding one field to PolicyConfig silently reverted every
  // admin-configured threshold to its shipped default.
  const stored = { [NUMERIC_KEY]: 123_456 };
  const merged = configFromRow({ config: stored });
  if (merged[NUMERIC_KEY] !== 123_456) throw new Error(`${NUMERIC_KEY} was defaulted away`);
  if (merged[OTHER_KEY] !== DEFAULT_POLICY_CONFIG[OTHER_KEY]) {
    throw new Error(`${OTHER_KEY} should fall back to its default`);
  }
});
check('a wrong-typed stored value is defaulted, not trusted', () => {
  const merged = configFromRow({ config: { [NUMERIC_KEY]: 'not a number' } });
  if (merged[NUMERIC_KEY] !== DEFAULT_POLICY_CONFIG[NUMERIC_KEY]) {
    throw new Error('a string threshold reached a numeric comparison');
  }
  const arrayKey = Object.keys(DEFAULT_POLICY_CONFIG)
    .find((k) => Array.isArray(DEFAULT_POLICY_CONFIG[k]));
  if (arrayKey) {
    const m = configFromRow({ config: { [arrayKey]: 'a,b' } });
    if (!Array.isArray(m[arrayKey])) throw new Error('a string replaced a list');
  }
});
check('a missing or malformed row is the shipped default', () => {
  if (configFromRow(undefined)[NUMERIC_KEY] !== DEFAULT_POLICY_CONFIG[NUMERIC_KEY]) {
    throw new Error('no row should mean defaults');
  }
  if (configFromRow({ config: 'nonsense' })[NUMERIC_KEY] !== DEFAULT_POLICY_CONFIG[NUMERIC_KEY]) {
    throw new Error('a non-object config should mean defaults');
  }
});
check('the policy config has keys to merge in the first place', () => {
  if (Object.keys(DEFAULT_POLICY_CONFIG).length < 10) throw new Error('unexpectedly small default config');
});

// Every route that evaluates a governed threshold reads the admin's row.
// generate-sow and chat-intake both passed DEFAULT_POLICY_CONFIG, so a
// `policy:<key>` token resolved to the shipped number and an admin's edit moved
// the browser and not generation.
for (const [label, path] of [
  ['generate-sow', 'api/generate-sow.ts'],
  ['chat-intake', 'api/chat-intake.ts'],
]) {
  check(`${label} reads the stored thresholds, not the shipped defaults`, () => {
    const source = read(path);
    if (/DEFAULT_POLICY_CONFIG/.test(source)) throw new Error('still evaluates against shipped defaults');
    if (!/loadPolicyConfig/.test(source)) throw new Error('does not load the stored config');
  });
}

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
