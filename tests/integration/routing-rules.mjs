#!/usr/bin/env node
// Verifies the routing-rule evaluator correctly routes requests through
// the admin-configured rules in the own store — proves that editing a rule in
// the Admin UI changes the buying-channel chosen at intake.
//
// Run: node tests/integration/routing-rules.mjs

import { readFileSync } from 'node:fs';
import { neonClient } from '../lib/live.mjs';

// The evaluator is IMPORTED, not mirrored.
//
// This file carried a hand-copied evaluator and a hand-copied fallback ladder,
// "keep in sync" in a comment. It went out of sync the moment routing rules
// learned to reference a governed threshold: the copy did not resolve
// `policy:` tokens, so RR-001 and RR-006 failed here while working in the app.
// A mirror that can disagree with the thing it mirrors tests the mirror.
import {
  resolveRouting, evaluateRoutingRules,
} from '../../src/lib/routing/evaluate-routing-rules.ts';
import { DEFAULT_POLICY_CONFIG } from '../../src/lib/procurement/policy-config.ts';
// The real mapper, not a copy. The local one dropped `priority`, which is the
// column that decides evaluation order — so the copy could not have detected
// the very thing it was about to get wrong.
import { mapDbToRoutingRule } from '../../src/lib/db/mappers.ts';

const sb = await neonClient('routing');

const results = [];
const pass = (n, d = '') => results.push({ n, o: 'PASS', d });
const fail = (n, d) => results.push({ n, o: 'FAIL', d });
const assert = (cond, n, d) => (cond ? pass(n, d) : fail(n, d));


async function main() {
  // Ordered exactly as src/lib/db/routing-rules.ts orders it. The select
  // carried no ORDER BY, so Postgres returned rows in physical order — and once
  // the fallback became data, a catch-all could be evaluated before the
  // specific rule it exists to back up.
  const { data, error } = await sb.from('routing_rules').select('*').order('priority').order('id');
  if (error) throw error;
  const rules = (data ?? []).map(mapDbToRoutingRule);
  const active = rules.filter((r) => r.status === 'active');
  assert(rules.length > 0, 'routing: rules fetched from the database', `total=${rules.length} active=${active.length}`);

  // ── Canonical scenarios that should match specific active seed rules ──
  const scenarios = [
    {
      // RR-001 (software above the budget-approval threshold) went: RR-902
      // already sends anything above that threshold procurement-led.
      label: 'High-value software (>€100k) is procurement-led',
      ctx: { category: 'software', value: 250000 },
      expectedRuleId: 'RR-902',
      expectedChannel: 'procurement-led',
    },
    {
      // Door 1 does not invent a catalogue order: a small demand with no
      // catalogue item behind it is the business's to buy (RR-002 is gone).
      label: 'Low-value goods (<€5k) is business-led',
      ctx: { category: 'goods', value: 4000 },
      expectedRuleId: 'RR-904',
      expectedChannel: 'business-led',
    },
    {
      label: 'Contingent labour is procurement-led',
      ctx: { category: 'contingent-labour', value: 20000 },
      expectedRuleId: 'RR-013',
      expectedChannel: 'procurement-led',
    },
    {
      label: 'Consulting engagement of any size',
      ctx: { category: 'consulting', value: 75000 },
      expectedRuleId: 'RR-003',
      expectedChannel: 'procurement-led',
    },
    {
      label: 'Above materiality (>€1M) is procurement-led',
      ctx: { category: 'services', value: 1_500_000 },
      expectedRuleId: 'RR-902',
      expectedChannel: 'procurement-led',
    },
    {
      label: 'Urgent request',
      ctx: { category: 'goods', value: 30000, isUrgent: true },
      expectedRuleId: 'RR-010',
      expectedChannel: 'procurement-led',
    },
    {
      label: 'A high-risk supplier goes through compliance escalation',
      ctx: { category: 'goods', value: 30000, supplierRiskRating: 'high' },
      expectedRuleId: 'RR-012',
      expectedChannel: 'procurement-led',
    },
  ];

  for (const s of scenarios) {
    const m = evaluateRoutingRules(rules, s.ctx, DEFAULT_POLICY_CONFIG);
    assert(
      m?.matchedRule?.id === s.expectedRuleId && m?.channel === s.expectedChannel,
      `routing: ${s.label}`,
      `matched=${m?.matchedRule?.id ?? 'none'} channel=${m?.channel ?? 'none'} expected=${s.expectedRuleId}/${s.expectedChannel}`,
    );
  }

  // ── No-match context falls back gracefully
  // The fallback is data now (RR-900…RR-905), so a demand nothing specific
  // matches is caught by a catch-all rather than by a code ladder. "No match"
  // therefore means no SPECIFIC rule matched.
  const specific = rules.filter((r) => (r.priority ?? 100) < 900);
  const noMatch = evaluateRoutingRules(specific, { category: 'unknown-category', value: 42 }, DEFAULT_POLICY_CONFIG);
  assert(noMatch === null, 'routing: no specific rule matches an unknown category',
    `got=${noMatch?.matchedRule?.id ?? 'null'}`);
  const fallback = resolveRouting(rules, { category: 'unknown-category', value: 42 }, DEFAULT_POLICY_CONFIG);
  assert(
    fallback.matchedRule?.id === 'RR-904' && fallback.channel === 'business-led',
    'routing: a small unmatched request is caught by the business-led ceiling',
    `channel=${fallback.channel} via ${fallback.matchedRule?.id ?? 'code floor'}`,
  );

  // ── Ensure disabled rules never match
  const disabled = rules.filter((r) => r.status === 'disabled');
  if (disabled.length > 0) {
    // Build a context guaranteed to match RR-012 if status were honoured
    const ctx = { supplierId: 'SUP-999', category: 'goods' };
    const m = evaluateRoutingRules(rules, ctx, DEFAULT_POLICY_CONFIG);
    assert(
      m?.matchedRule?.status !== 'disabled',
      'routing: disabled rules are skipped',
      `matched=${m?.matchedRule?.id ?? 'none'} status=${m?.matchedRule?.status ?? 'n/a'}`,
    );
  }

  // ── Risk-aware routing (risk_rating operator) — self-contained inline rules
  const riskRules = [
    {
      id: 'RISK-FULL', name: 'High/critical risk → procurement-led', status: 'active',
      conditions: [{ field: 'riskRating', operator: 'risk_rating', value: 'high' }],
      action: { buyingChannel: 'procurement-led', approvalChain: 'category-manager > finance' },
    },
    {
      id: 'RISK-LIGHT', name: 'Low-value default → business-led', status: 'active',
      conditions: [{ field: 'value', operator: 'less_than', value: '50000' }],
      action: { buyingChannel: 'business-led', approvalChain: 'category-manager' },
    },
  ];
  const critical = evaluateRoutingRules(riskRules, { value: 10000, riskRating: 'critical' }, DEFAULT_POLICY_CONFIG);
  assert(critical?.matchedRule?.id === 'RISK-FULL', 'routing: critical risk escalates over low value',
    `matched=${critical?.matchedRule?.id ?? 'none'} channel=${critical?.channel ?? 'none'}`);
  const high = evaluateRoutingRules(riskRules, { value: 10000, riskRating: 'high' }, DEFAULT_POLICY_CONFIG);
  assert(high?.matchedRule?.id === 'RISK-FULL', 'routing: high risk meets the threshold',
    `matched=${high?.matchedRule?.id ?? 'none'}`);
  const lowRisk = evaluateRoutingRules(riskRules, { value: 10000, riskRating: 'low' }, DEFAULT_POLICY_CONFIG);
  assert(lowRisk?.matchedRule?.id === 'RISK-LIGHT', 'routing: low risk falls through to value rule',
    `matched=${lowRisk?.matchedRule?.id ?? 'none'}`);
  const noRisk = evaluateRoutingRules(riskRules, { value: 10000 }, DEFAULT_POLICY_CONFIG);
  assert(noRisk?.matchedRule?.id === 'RISK-LIGHT', 'routing: absent risk does not trigger risk rule',
    `matched=${noRisk?.matchedRule?.id ?? 'none'}`);

  // ── Materiality-aware routing (material field) — self-contained inline rules
  const matRules = [
    {
      id: 'MAT-FULL', name: 'Material demand → procurement-led', status: 'active',
      conditions: [{ field: 'material', operator: 'equals', value: 'true' }],
      action: { buyingChannel: 'procurement-led', approvalChain: 'category-manager > finance > legal' },
    },
    {
      id: 'MAT-LIGHT', name: 'Low-value default → business-led', status: 'active',
      conditions: [{ field: 'value', operator: 'less_than', value: '50000' }],
      action: { buyingChannel: 'business-led', approvalChain: 'category-manager' },
    },
  ];
  const material = evaluateRoutingRules(matRules, { value: 10000, material: true }, DEFAULT_POLICY_CONFIG);
  assert(material?.matchedRule?.id === 'MAT-FULL', 'routing: material demand escalates over low value',
    `matched=${material?.matchedRule?.id ?? 'none'} channel=${material?.channel ?? 'none'}`);
  const notMaterial = evaluateRoutingRules(matRules, { value: 10000, material: false }, DEFAULT_POLICY_CONFIG);
  assert(notMaterial?.matchedRule?.id === 'MAT-LIGHT', 'routing: non-material falls through to value rule',
    `matched=${notMaterial?.matchedRule?.id ?? 'none'}`);

  const failed = results.filter((r) => r.o === 'FAIL').length;
  for (const r of results) {
    const tag = r.o === 'PASS' ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    console.log(`  ${tag}  ${r.n}`);
    if (r.d) console.log(`        ${r.d}`);
  }
  console.log(`\n  ${results.length - failed} passed, ${failed} failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
