#!/usr/bin/env node
// Routing rules reference governed thresholds, and referencing changed nothing.
//
// The migration replaced three literal amounts with `policy:<key>` tokens and
// cleared an approval-chain field that had never resolved. Both are meant to be
// behaviour-neutral, and "meant to be" is not evidence — so this evaluates a
// labelled demand grid through the real evaluator and asserts the channel is
// identical to what the pre-migration literals produced.
//
// It also holds the seams that make the indirection safe: a token must never
// reach evalCondition unresolved, no serverless module may import the evaluator
// (the config would silently be shipped defaults there), and every rule naming
// an approval chain must name one that exists.
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { loadEnv } from '../lib/live.mjs';
import {
  resolveRouting, resolveRuleConditions, diagnoseRules, evalCondition,
} from '../../src/lib/routing/evaluate-routing-rules.ts';
import { DEFAULT_POLICY_CONFIG, resolvePolicyConfig } from '../../src/lib/procurement/policy-config.ts';
import { routingRules } from '../../src/data/routing-rules.ts';

const ROOT = new URL('../../', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, ROOT), 'utf8');
let failures = 0;
const ok = (label) => console.log(`  \x1b[32m✓\x1b[0m ${label}`);
const bad = (label, detail) => {
  failures += 1;
  console.error(`  \x1b[31m✗\x1b[0m ${label}`);
  if (detail) console.error(`      ${detail}`);
};

const CONFIG = DEFAULT_POLICY_CONFIG;

// ── The migration is behaviour-neutral ─────────────────────────────────────
// The literals as they stood before the migration, restored onto a copy of the
// rule set. If tokens resolve correctly these two rule sets are the same rules.
const PRE_MIGRATION = { 'RR-001': '100000', 'RR-006': '1000000', 'RR-007': '25000' };
const asLiterals = routingRules.map((r) => {
  const literal = PRE_MIGRATION[r.id];
  if (!literal) return r;
  return {
    ...r,
    conditions: r.conditions.map((c) =>
      c.field === 'value' && String(c.value).startsWith('policy:') ? { ...c, value: literal } : c),
  };
});

console.log('\nTokenising changed no routing outcome');
const CATEGORIES = ['software', 'services', 'goods', 'consulting', 'contingent-labour', 'supplier-onboarding', 'contract-renewal'];
const VALUES = [0, 999, 4999, 5000, 9999, 10000, 24999, 25000, 25001, 49999, 50000, 99999, 100000, 100001, 250000, 500000, 999999, 1000000, 1000001, 5000000];
const COMMODITIES = [undefined, '432100', '761200', '801400'];
let compared = 0;
let drift = 0;
for (const category of CATEGORIES) {
  for (const value of VALUES) {
    for (const commodityCode of COMMODITIES) {
      for (const isUrgent of [false, true]) {
        const ctx = {
          category, value, commodityCode, isUrgent,
          priority: isUrgent ? 'urgent' : undefined,
          supplierId: 'SUP-001', pCardEligible: false,
        };
        const before = resolveRouting(asLiterals, ctx, CONFIG);
        const after = resolveRouting(routingRules, ctx, CONFIG);
        compared += 1;
        if (before.channel !== after.channel || (before.matchedRule?.id ?? null) !== (after.matchedRule?.id ?? null)) {
          drift += 1;
          if (drift <= 3) {
            bad(`${category} €${value} cc=${commodityCode ?? '—'} urgent=${isUrgent}`,
              `literal → ${before.channel} via ${before.matchedRule?.id ?? 'fallback'}; token → ${after.channel} via ${after.matchedRule?.id ?? 'fallback'}`);
          }
        }
      }
    }
  }
}
if (drift === 0) ok(`${compared} demands route identically before and after tokenising`);
else bad(`${drift} of ${compared} demands changed channel`, 'the migration is not behaviour-neutral');

// ── A token moves when the threshold moves ─────────────────────────────────
console.log('\nA governed threshold actually drives the rule');
const softwareCtx = { category: 'software', value: 120_000, supplierId: 'SUP-001', pCardEligible: false };
const atDefault = resolveRouting(routingRules, softwareCtx, CONFIG);
const raised = resolveRouting(routingRules, softwareCtx, resolvePolicyConfig({ budgetApprovalThreshold: 200_000 }));
if (atDefault.matchedRule?.id !== 'RR-001') {
  bad('€120k software matches RR-001 at the default threshold', `matched ${atDefault.matchedRule?.id ?? 'nothing'}`);
} else if (raised.matchedRule?.id === 'RR-001') {
  bad('raising the threshold to €200k stops RR-001 matching €120k',
    'the rule still fired, so the token is not being resolved against the passed config');
} else {
  ok('raising budgetApprovalThreshold to €200k takes €120k software out of RR-001');
}

// ── An unresolved token must never reach the evaluator ─────────────────────
console.log('\nAn unresolved token is loud, not false');
const stored = { id: 'X', name: 'x', status: 'active', conditions: [{ field: 'value', operator: 'greater_than', value: 'policy:budgetApprovalThreshold' }], action: { buyingChannel: 'catalogue', approvalChain: '' } };
const resolvedRule = resolveRuleConditions(stored, CONFIG);
if (resolvedRule.conditions[0].value !== '100000') {
  bad('resolveRuleConditions substitutes the number', resolvedRule.conditions[0].value);
} else ok('resolveRuleConditions substitutes before evaluation');

const errors = [];
const realError = console.error;
console.error = (...a) => errors.push(a.join(' '));
const leaked = evalCondition('value', 'greater_than', 'policy:budgetApprovalThreshold', { value: 999_999 });
console.error = realError;
if (leaked !== false || errors.length === 0) {
  bad('a token reaching evalCondition is reported', `returned ${leaked}, logged ${errors.length} error(s)`);
} else ok('a token reaching evalCondition returns false AND logs — not a silent near-miss');

// ── No serverless module may reach the evaluator ───────────────────────────
console.log('\nThe serverless side cannot evaluate against shipped defaults');
const apiFiles = read('api/db.ts') && [
  'api/_domains/intake-submit.ts', 'api/governed-checkout.ts', 'api/workflow-action.ts',
  'api/chat.ts', 'api/ai.ts',
];
const offenders = apiFiles.filter((f) => {
  try { return /evaluate-routing-rules|demand-channel|intake-determination/.test(read(f)); }
  catch { return false; }
});
if (offenders.length) {
  bad('no api/ module imports the routing evaluator',
    `${offenders.join(', ')} — the active policy config is a browser-boot singleton, so a serverless caller would evaluate against shipped defaults`);
} else ok('no serverless handler imports the routing evaluator');

// ── The editor no longer offers role paths as chains ───────────────────────
console.log('\nThe rule editor offers real approval chains');
const editor = read('src/features/admin/routing-rules/components/rule-editor-panel.tsx');
// Match the option-list shape, not the prose: the file keeps a comment naming
// one of those strings to explain why they went, and a guard that fails on its
// own post-mortem teaches people to delete the explanation.
if (/APPROVAL_CHAIN_OPTIONS/.test(editor) || /value: '[a-z-]+ > /.test(editor)) {
  bad('the role-path chain options are gone',
    'those strings were written into action.approvalChain while intake looked it up as an id');
} else ok('the nine role-path options are gone');
if (!/useApprovalChains/.test(editor)) bad('the chain select is driven by the chains table', 'no useApprovalChains');
else ok('the chain select is driven by approval_chains');

// ── Live: every rule names a chain that exists ─────────────────────────────
const env = loadEnv();
const connection = env.NEON_DATABASE_URL || env.DATABASE_URL;
if (!connection) {
  console.log('\n  (skipped live checks — no database connection)');
} else {
  console.log('\nLive rules name chains that exist');
  const sql = neon(connection);
  const [chains, live] = await Promise.all([
    sql`SELECT id, threshold FROM approval_chains`,
    sql`SELECT id, name, status, conditions, action FROM routing_rules ORDER BY id`,
  ]);
  const chainIds = chains.map((c) => c.id);
  const dangling = live.filter((r) => r.action?.approvalChain && !chainIds.includes(r.action.approvalChain));
  if (dangling.length) {
    bad('no rule names a chain that does not exist',
      dangling.map((r) => `${r.id} → "${r.action.approvalChain}"`).join(', '));
  } else ok(`all ${live.length} live rules name a configured chain or defer to the value band`);

  // The compliance chain must be reachable by name and unreachable by value.
  const compliance = chains.find((c) => c.id === 'chain-compliance');
  if (!compliance) bad('the compliance chain exists', 'RR-008 and RR-012 name it');
  else if (/\d/.test(compliance.threshold)) {
    bad('the compliance chain carries no value band',
      `"${compliance.threshold}" contains a number, so it could be selected by value and shadow a banded chain`);
  } else ok('the compliance chain is reachable by rule and never by value');

  const brokenLive = diagnoseRules(live, { config: CONFIG, chainIds });
  if (brokenLive.length) {
    bad('no active live rule is diagnosed broken',
      brokenLive.map((d) => `${d.ruleId}: ${d.problems.join('; ')}`).join(' | '));
  } else ok('every active live rule is evaluable');
}

console.log(failures === 0 ? '\n\x1b[32mpolicy-token-routing passed\x1b[0m' : `\n\x1b[31m${failures} failed\x1b[0m`);
process.exit(failures === 0 ? 0 : 1);
