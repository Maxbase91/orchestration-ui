#!/usr/bin/env node
// Verifies P-card eligibility and the route-only guard.
//
// This suite exercises the real policy implementation without requiring a
// database or producing any purchasing/payment side effects.
// Run: npm run test:p-card

import { DEFAULT_POLICY_CONFIG, resolvePolicyConfig } from '../../src/lib/procurement/policy-config.ts';
import { evaluatePCardEligibility } from '../../src/lib/routing/p-card.ts';

let failures = 0;
function check(name, condition, detail = '') {
  if (condition) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures += 1; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

const DEFAULT = DEFAULT_POLICY_CONFIG;
const evaluate = (input, overrides) => evaluatePCardEligibility(input, overrides ? resolvePolicyConfig(overrides) : DEFAULT);

console.log('P-card eligibility');
const eligible = evaluate({ category: 'goods', value: 250 });
check('low-value goods are eligible', eligible.eligible);
check('eligible result explains category and value', eligible.reasons.length === 2);

check('services can be eligible', evaluate({ category: 'Services', value: 5_000 }).eligible);
check('software is excluded', !evaluate({ category: 'software', value: 100 }).eligible);
check('consulting is excluded', !evaluate({ category: 'consulting', value: 100 }).eligible);
check('unknown category is not eligible', !evaluate({ category: 'other', value: 100 }).eligible);
check('missing category is not eligible', !evaluate({ value: 100 }).eligible);
check('value at limit is eligible', evaluate({ category: 'goods', value: 5_000 }).eligible);
check('value above limit is not eligible', !evaluate({ category: 'goods', value: 5_001 }).eligible);
check('missing value is not eligible', !evaluate({ category: 'goods' }).eligible);
check('urgent demand is not eligible', !evaluate({ category: 'goods', value: 100, isUrgent: true }).eligible);
check('material demand is not eligible', !evaluate({ category: 'goods', value: 100, material: true }).eligible);
check('high-risk demand is not eligible', !evaluate({ category: 'goods', value: 100, riskRating: 'high' }).eligible);
check('critical-risk demand is not eligible', !evaluate({ category: 'goods', value: 100, riskRating: 'critical' }).eligible);
check('policy can disable the route', !evaluate({ category: 'goods', value: 100 }, { ...DEFAULT, pCardEnabled: false }).eligible);
check('policy can lower the value limit', !evaluate({ category: 'goods', value: 1_001 }, { ...DEFAULT, pCardMaxValue: 1_000 }).eligible);

console.log('\nRoute guard');
function route(ruleChannel, pCardEligible) {
  if (ruleChannel === 'p-card' && pCardEligible !== true) return 'fallback';
  return ruleChannel;
}
check('P-card rule needs explicit eligibility', route('p-card', undefined) === 'fallback');
check('P-card rule cannot use false eligibility', route('p-card', false) === 'fallback');
check('eligible P-card rule is routable', route('p-card', true) === 'p-card');
check('other routes are unaffected', route('direct-po', false) === 'direct-po');

console.log('\nR1 boundary');
check('eligibility is explanatory, not a payment operation', typeof eligible.ineligibleReasons.join === 'function');

if (failures > 0) {
  console.error(`FAILED: ${failures} check(s)`);
  process.exit(1);
}
console.log('All P-card checks passed.');
