#!/usr/bin/env node
// Routing-rule integrity — the editor, the tester and the runtime must agree.
//
// The failure this exists to prevent: an unrecognised field or operator used to
// return `false`, and because a rule requires `conditions.every(...)`, one
// unrecognised condition silently killed the whole rule. The admin editor
// offered THREE fields (`contractId`, `riskLevel`, `region`) and THREE operators
// (`contains`, `is_empty`, `is_not_empty`) the evaluator did not implement — and
// the built-in Test panel implemented some of them itself. So an admin could
// write a rule, have the tester confirm it matched, and have it never fire.
//
// Live proof: RR-001 "High-value IT software" was active, first in evaluation
// order, described as routing software over EUR 100k to procurement-led, and
// carried match_count = 42. It had never matched once.
//
// The runtime half is IMPORTED, not mirrored.
//
// This file used to carry a hand-copied evaluator, diagnoser and fallback
// ladder under a "keep in sync" comment. It did not stay in sync: the copy
// never learned `not_equals`, never resolved `policy:` tokens, and kept a
// verbatim copy of the if-ladder that has now been deleted from the codebase —
// so it would have gone on passing against code that no longer exists. A
// mirror that can disagree with the thing it mirrors tests the mirror.
//
// The EDITOR lists below are still local, deliberately: they are the thing
// being compared AGAINST the runtime, so importing both sides would assert
// nothing.
// Run: npm run test:routing-rule-integrity

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

import {
  SUPPORTED_FIELDS, SUPPORTED_OPERATORS, evalCondition, diagnoseRule as diagnoseRuleReal,
  resolveRouting as resolveRoutingReal, evaluateRoutingRules,
} from '../../src/lib/routing/evaluate-routing-rules.ts';
import { DEFAULT_POLICY_CONFIG } from '../../src/lib/procurement/policy-config.ts';
import { routingRules } from '../../src/data/routing-rules.ts';

const CONFIG = DEFAULT_POLICY_CONFIG;
const diagnoseRule = (rule) => diagnoseRuleReal(rule, { config: CONFIG });
// The fallback is data now (RR-900…RR-905), so "what happens when no specific
// rule matches" means evaluating with the catch-alls present.
const CATCH_ALLS = routingRules.filter((r) => (r.priority ?? 100) >= 900);
// "Did this specific rule match?" — the catch-alls are deliberately absent, so
// a null answer means the rule under test did not fire.
const evaluate = (rules, ctx) => evaluateRoutingRules(rules, ctx, CONFIG);
const resolveRouting = (rules, ctx) =>
  resolveRoutingReal([...rules, ...CATCH_ALLS], ctx, CONFIG).channel;

// Mirrors the admin editor's lists (condition-card.tsx). These two MUST match
// the runtime's, which is the whole point of this suite.
const EDITOR_FIELDS = [
  'value', 'category', 'supplierId', 'contractId', 'riskRating',
  'material', 'region', 'commodityCode', 'priority', 'isUrgent',
];
const EDITOR_OPERATORS = [
  'equals', 'greater_than', 'less_than', 'contains', 'starts_with',
  'in', 'between', 'is_empty', 'is_not_empty', 'risk_rating',
];

const mk = (id, conditions, channel = 'procurement-led') => ({
  id, name: id, status: 'active', conditions,
  action: { buyingChannel: channel, approvalChain: 'x' },
});

// ── the parity that this whole suite exists to hold ─────────────────────────

console.log('The editor and the runtime offer the same vocabulary');
for (const f of EDITOR_FIELDS) {
  check(`field "${f}" offered in the editor is evaluated`, SUPPORTED_FIELDS.includes(f));
}
for (const o of EDITOR_OPERATORS) {
  check(`operator "${o}" offered in the editor is evaluated`, SUPPORTED_OPERATORS.includes(o));
}
// The reverse direction matters too: a field the engine reads but the editor
// hides is a capability nobody can reach. `riskRating` and `material` were
// exactly that.
for (const f of SUPPORTED_FIELDS) {
  check(`field "${f}" the engine reads is offered in the editor`, EDITOR_FIELDS.includes(f));
}

console.log('\nRR-001, the rule that was active and dead');
const oldRR001 = mk('RR-001-old', [
  { field: 'contractId', operator: 'less_than', value: 'false' },
  { field: 'supplierId', operator: 'between', value: '100000' },
  { field: 'priority', operator: 'is_empty', value: '' },
]);
check('it never matched the demand it described',
  evaluate([oldRR001], { category: 'software', value: 150_000 }) === null);
// Post-fix, contractId and is_empty ARE supported, so the remaining structural
// fault is the one-bound `between` — which is now reported rather than silent.
check('its malformed `between` is now diagnosed, not silent',
  diagnoseRule(oldRR001).some((p) => /needs two comma-separated bounds/.test(p)));

const rr001 = mk('RR-001', [
  { field: 'category', operator: 'equals', value: 'software' },
  { field: 'value', operator: 'greater_than', value: '100000' },
]);
check('the repaired rule is healthy', diagnoseRule(rr001).length === 0, diagnoseRule(rr001).join('; '));
check('and matches the demand its description names',
  evaluate([rr001], { category: 'software', value: 150_000 }) !== null);
check('and still does not match software below the threshold',
  evaluate([rr001], { category: 'software', value: 50_000 }) === null);

console.log('\nA broken rule is visibly broken');
check('an unknown field is diagnosed',
  diagnoseRule(mk('x', [{ field: 'madeUp', operator: 'equals', value: 'y' }])).length > 0);
check('an unsupported operator is diagnosed',
  diagnoseRule(mk('x', [{ field: 'value', operator: 'sounds_like', value: 'y' }])).length > 0);
check('a rule with no conditions is diagnosed',
  diagnoseRule(mk('x', [])).length > 0);
check('a healthy rule produces no diagnostics',
  diagnoseRule(mk('x', [{ field: 'value', operator: 'greater_than', value: '1' }])).length === 0);

console.log('\nThe operators the editor always offered and the engine never ran');
check('contains', evaluate([mk('c', [{ field: 'category', operator: 'contains', value: 'sult' }])], { category: 'consulting' }) !== null);
check('contains is case-insensitive', evaluate([mk('c', [{ field: 'category', operator: 'contains', value: 'SULT' }])], { category: 'consulting' }) !== null);
// The case that made RR-001 dead: "is empty" must be answerable about a field
// that is absent, which the old undefined-guard made impossible.
check('is_empty is TRUE when the field is absent',
  evaluate([mk('e', [{ field: 'contractId', operator: 'is_empty', value: '' }])], { category: 'goods' }) !== null);
check('is_empty is FALSE when the field is present',
  evaluate([mk('e', [{ field: 'contractId', operator: 'is_empty', value: '' }])], { contractId: 'CON-1' }) === null);
check('is_not_empty is TRUE when the field is present',
  evaluate([mk('n', [{ field: 'contractId', operator: 'is_not_empty', value: '' }])], { contractId: 'CON-1' }) !== null);

console.log('\nThe fields the editor offered and the engine never read');
check('contractId', evaluate([mk('f', [{ field: 'contractId', operator: 'equals', value: 'CON-1' }])], { contractId: 'CON-1' }) !== null);
check('region', evaluate([mk('f', [{ field: 'region', operator: 'equals', value: 'EMEA' }])], { region: 'EMEA' }) !== null);
// riskRating was reachable at runtime but the editor called it riskLevel, so
// the obvious "route on risk" rule was dead on a name mismatch.
check('riskRating (was riskLevel in the editor)',
  evaluate([mk('f', [{ field: 'riskRating', operator: 'risk_rating', value: 'high' }])], { riskRating: 'critical' }) !== null);
check('material', evaluate([mk('f', [{ field: 'material', operator: 'equals', value: 'true' }])], { material: true }) !== null);

console.log('\nRR-010 is the one rule that can still move the answer after step 2');
const rr010 = mk('RR-010', [
  { field: 'priority', operator: 'equals', value: 'urgent' },
  { field: 'isUrgent', operator: 'equals', value: 'true' },
]);
check('it fires only on urgency', evaluate([rr010], { priority: 'urgent', isUrgent: true }) !== null);
check('and is quiet otherwise', evaluate([rr010], { priority: 'high', isUrgent: false }) === null);
// This is why the urgency toggle has to say what it does: the channel shown on
// the pre-check is settled EXCEPT for this, and the change is user-caused.
const before = resolveRouting([rr010], { category: 'services', value: 30_000 });
const after = resolveRouting([rr010], { category: 'services', value: 30_000, priority: 'urgent', isUrgent: true });
check('marking a demand urgent can change its channel', before !== after, `${before} -> ${after}`);
check('and it only ever escalates to procurement-led', after === 'procurement-led');

console.log('');
if (failures) console.error(`FAILED: ${failures} check(s)`);
else console.log('All routing-rule-integrity checks passed.');
process.exit(failures === 0 ? 0 : 1);
