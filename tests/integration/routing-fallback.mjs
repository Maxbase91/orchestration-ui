#!/usr/bin/env node
// The fallback is data now, and it does what the code it replaced did.
//
// `fallbackBuyingChannel` was a five-branch if-ladder restating three governed
// thresholds where no admin could see them — and it is why RR-001 sat dead for
// months: the ladder happened to agree with it, so nothing looked wrong.
//
// RR-900…RR-905 replace it. This asserts they reproduce it exactly across the
// value and category space, that the rule set still answers for every demand,
// and that deactivating the catch-alls degrades visibly rather than silently.
import { readFileSync } from 'node:fs';
import {
  resolveRouting, evaluateRoutingRules, uncoveredDemand, CHANNEL_OF_LAST_RESORT,
} from '../../src/lib/routing/evaluate-routing-rules.ts';
import { DEFAULT_POLICY_CONFIG, resolvePolicyConfig } from '../../src/lib/procurement/policy-config.ts';
import { routingRules } from '../../src/data/routing-rules.ts';

const ROOT = new URL('../../', import.meta.url);
let failures = 0;
const ok = (l) => console.log(`  \x1b[32m✓\x1b[0m ${l}`);
const bad = (l, d) => { failures += 1; console.error(`  \x1b[31m✗\x1b[0m ${l}`); if (d) console.error(`      ${d}`); };

const CONFIG = DEFAULT_POLICY_CONFIG;

/** The deleted ladder, verbatim, as the oracle. */
function deletedLadder(ctx) {
  const value = ctx.value ?? 0;
  const category = ctx.category ?? '';
  if (value < 25000) return 'catalogue';
  if (category === 'consulting' || value > 100000) return 'procurement-led';
  if (category === 'contingent-labour') return 'framework-call-off';
  if (value <= 50000) return 'business-led';
  return 'procurement-led';
}

// Only the catch-alls: the oracle is the *fallback*, so a specific rule
// matching first would be comparing two different things.
const CATCH_ALLS = routingRules.filter((r) => (r.priority ?? 100) >= 900);

console.log('\nThe catch-all rules reproduce the deleted ladder');
const CATEGORIES = ['goods', 'services', 'software', 'consulting', 'contingent-labour', 'contract-renewal', ''];
const VALUES = [0, 1, 999, 4999, 24999, 25000, 25001, 49999, 50000, 50001, 99999, 100000, 100001, 250000, 1000000, 5000000];
let compared = 0, drift = 0;
for (const category of CATEGORIES) {
  for (const value of VALUES) {
    const expected = deletedLadder({ category, value });
    const actual = resolveRouting(CATCH_ALLS, { category, value, pCardEligible: false }, CONFIG).channel;
    compared += 1;
    if (expected !== actual) {
      drift += 1;
      if (drift <= 5) bad(`${category || '(none)'} €${value}`, `ladder → ${expected}; rules → ${actual}`);
    }
  }
}
if (drift === 0) ok(`${compared} demands get the same channel the if-ladder gave`);
else bad(`${drift} of ${compared} demands differ`, 'the catch-alls do not reproduce the ladder');

// The boundaries are where an off-by-one lives, so name them explicitly.
console.log('\nThe governed boundaries land exactly where the ladder put them');
const at = (category, value) => resolveRouting(CATCH_ALLS, { category, value, pCardEligible: false }, CONFIG).channel;
const boundaries = [
  ['€24,999 goods is catalogue', at('goods', 24_999), 'catalogue'],
  ['€25,000 goods is not catalogue', at('goods', 25_000) !== 'catalogue', true],
  ['€50,000 goods is business-led (between is inclusive)', at('goods', 50_000), 'business-led'],
  ['€50,001 goods is procurement-led', at('goods', 50_001), 'procurement-led'],
  ['€100,000 goods is procurement-led', at('goods', 100_000), 'procurement-led'],
  ['€30,000 contingent labour is framework-call-off', at('contingent-labour', 30_000), 'framework-call-off'],
  ['€1,000 consulting is catalogue (value is asked first)', at('consulting', 1_000), 'catalogue'],
  ['€30,000 consulting is procurement-led', at('consulting', 30_000), 'procurement-led'],
];
for (const [label, actual, expected] of boundaries) {
  if (actual === expected) ok(label); else bad(label, `got ${actual}`);
}

// ── The catch-alls follow the governed thresholds ──────────────────────────
console.log('\nMoving a threshold moves the fallback');
const raised = resolvePolicyConfig({ businessLedCeiling: 80_000 });
const before = resolveRouting(CATCH_ALLS, { category: 'goods', value: 70_000, pCardEligible: false }, CONFIG).channel;
const after = resolveRouting(CATCH_ALLS, { category: 'goods', value: 70_000, pCardEligible: false }, raised).channel;
if (before !== 'procurement-led' || after !== 'business-led') {
  bad('raising businessLedCeiling to €80k moves €70k goods to business-led', `${before} → ${after}`);
} else ok('raising businessLedCeiling to €80k moves €70k goods from procurement-led to business-led');

// ── Ordering is explicit, not alphabetical luck ────────────────────────────
console.log('\nEvaluation order is explicit');
const ruleSource = readFileSync(new URL('src/lib/db/routing-rules.ts', ROOT), 'utf8');
if (!/\.order\('priority'\)/.test(ruleSource)) {
  bad('rules are read in priority order',
    "ordering by id alone means one admin rule named after RR-9xx shadows every specific rule");
} else ok('rules are read priority-first');
const misPriority = routingRules.filter((r) => r.id.startsWith('RR-9') !== ((r.priority ?? 100) >= 900));
if (misPriority.length) bad('every RR-9xx rule carries a catch-all priority and vice versa', misPriority.map((r) => r.id).join(', '));
else ok('catch-all naming and catch-all priority agree');

// ── The floor exists, and is visible ───────────────────────────────────────
console.log('\nA hole in the rule set degrades visibly, not silently');
const withoutTerminator = CATCH_ALLS.filter((r) => r.id !== 'RR-905');
const holes = uncoveredDemand(withoutTerminator, CONFIG);
if (holes.length === 0) {
  bad('deactivating the always-true catch-all is reported', 'uncoveredDemand found nothing, so the page would show no warning');
} else ok(`deactivating RR-905 surfaces ${holes.length} uncovered example(s) for the admin`);
if (uncoveredDemand(routingRules, CONFIG).length !== 0) {
  bad('the shipped rule set covers everything', JSON.stringify(uncoveredDemand(routingRules, CONFIG)));
} else ok('the shipped rule set leaves no uncovered demand');

const warns = [];
const realWarn = console.warn;
console.warn = (...a) => warns.push(a.join(' '));
const floored = resolveRouting([], { category: 'goods', value: 70_000, pCardEligible: false }, CONFIG);
console.warn = realWarn;
if (floored.channel !== CHANNEL_OF_LAST_RESORT || floored.matchedRule !== null) {
  bad('an empty rule set still yields a channel', JSON.stringify(floored));
} else if (warns.length === 0) {
  bad('reaching the code floor is logged', 'it would be a silent fallback again');
} else ok(`an empty rule set yields ${CHANNEL_OF_LAST_RESORT} AND logs`);

// ── The ladder is really gone ──────────────────────────────────────────────
console.log('\nThe if-ladder is gone from the code');
const evaluator = readFileSync(new URL('src/lib/routing/evaluate-routing-rules.ts', ROOT), 'utf8');
if (/fallbackBuyingChannel/.test(evaluator)) bad('fallbackBuyingChannel is deleted', 'still present');
else ok('fallbackBuyingChannel is deleted');
// Comments are stripped first: the file keeps a post-mortem quoting one of
// these numbers to explain a past bug, and a guard that fails on its own
// explanation teaches people to delete the explanation.
const evaluatorCode = evaluator
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');
const restated = ['25000', '100000', '50000'].filter((n) => new RegExp(`\\b${n}\\b`).test(evaluatorCode));
if (restated.length) {
  bad('no governed threshold is restated in the evaluator',
    `${restated.join(', ')} — those numbers belong to the decisioning thresholds`);
} else ok('no governed threshold is restated in the evaluator');

// The stale mirrors are the other half of the problem.
const integrity = readFileSync(new URL('tests/integration/routing-rule-integrity.mjs', ROOT), 'utf8');
if (/function fallbackBuyingChannel/.test(integrity)) {
  bad('no test carries its own copy of the deleted ladder',
    'routing-rule-integrity.mjs mirrors it, so it would keep passing against code that no longer exists');
} else ok('no test mirrors the deleted ladder');

console.log(failures === 0 ? '\n\x1b[32mrouting-fallback passed\x1b[0m' : `\n\x1b[31m${failures} failed\x1b[0m`);
process.exit(failures === 0 ? 0 : 1);
