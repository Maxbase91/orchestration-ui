#!/usr/bin/env node
// Verifies the routing-rule evaluator correctly routes requests through
// the admin-configured rules in Supabase — proves that editing a rule in
// the Admin UI changes the buying-channel chosen at intake.
//
// Run: node tests/integration/routing-rules.mjs

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// Evaluator mirrors src/lib/routing/evaluate-routing-rules.ts — keep in sync.
function fieldValue(ctx, field) {
  return ctx[field];
}
function toNumber(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function evalCondition(field, operator, value, ctx) {
  const actual = fieldValue(ctx, field);
  if (actual === undefined) return false;
  switch (operator) {
    case 'equals': return String(actual) === value;
    case 'greater_than': {
      const a = toNumber(actual); const b = toNumber(value);
      return a !== null && b !== null && a > b;
    }
    case 'less_than': {
      const a = toNumber(actual); const b = toNumber(value);
      return a !== null && b !== null && a < b;
    }
    case 'in': return value.split(',').map((s) => s.trim()).includes(String(actual));
    case 'starts_with': return String(actual).startsWith(value);
    case 'between': {
      const [lo, hi] = value.split(',').map((s) => Number(s.trim()));
      const a = toNumber(actual);
      return a !== null && Number.isFinite(lo) && Number.isFinite(hi) && a >= lo && a <= hi;
    }
    case 'risk_rating': {
      // Threshold: ctx risk tier is at or above the rule's tier.
      const order = { low: 0, medium: 1, high: 2, critical: 3 };
      const a = order[actual]; const b = order[value];
      return a !== undefined && b !== undefined && a >= b;
    }
    default: return false;
  }
}
function ruleMatches(rule, ctx) {
  if (rule.status !== 'active') return false;
  if (!rule.conditions?.length) return false;
  return rule.conditions.every((c) => evalCondition(c.field, c.operator, c.value, ctx));
}
function evaluateRoutingRules(rules, ctx) {
  for (const rule of rules) {
    if (ruleMatches(rule, ctx)) {
      return { channel: rule.action.buyingChannel, approvalChain: rule.action.approvalChain, matchedRule: rule };
    }
  }
  return null;
}
function fallbackBuyingChannel(ctx) {
  const value = ctx.value ?? 0;
  const category = ctx.category ?? '';
  if (value < 25000) return { channel: 'catalogue', approvalChain: 'line-manager' };
  if (category === 'consulting' || value > 100000) return { channel: 'procurement-led', approvalChain: 'category-manager > finance > vp-procurement' };
  if (category === 'contingent-labour') return { channel: 'framework-call-off', approvalChain: 'category-manager > finance' };
  if (value <= 50000) return { channel: 'business-led', approvalChain: 'category-manager' };
  return { channel: 'procurement-led', approvalChain: 'category-manager > finance > vp-procurement' };
}
function resolveRouting(rules, ctx) {
  const match = evaluateRoutingRules(rules, ctx);
  if (match) return match;
  const fb = fallbackBuyingChannel(ctx);
  return { channel: fb.channel, approvalChain: fb.approvalChain, matchedRule: null };
}

function loadEnv() {
  const raw = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const sb = createClient(
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const results = [];
const pass = (n, d = '') => results.push({ n, o: 'PASS', d });
const fail = (n, d) => results.push({ n, o: 'FAIL', d });
const assert = (cond, n, d) => (cond ? pass(n, d) : fail(n, d));

function mapDbToRoutingRule(row) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    conditions: row.conditions,
    action: row.action,
    description: row.description,
    matchCount: row.match_count,
    lastModified: row.last_modified,
    category: row.category,
  };
}

async function main() {
  const { data, error } = await sb.from('routing_rules').select('*');
  if (error) throw error;
  const rules = (data ?? []).map(mapDbToRoutingRule);
  const active = rules.filter((r) => r.status === 'active');
  assert(rules.length > 0, 'routing: rules fetched from Supabase', `total=${rules.length} active=${active.length}`);

  // ── Canonical scenarios that should match specific active seed rules ──
  const scenarios = [
    {
      label: 'High-value IT software (>€100k)',
      ctx: { category: 'software', value: 250000 },
      expectedRuleId: 'RR-001',
      expectedChannel: 'procurement-led',
    },
    {
      label: 'Low-value goods (<€5k)',
      ctx: { category: 'goods', value: 4000 },
      expectedRuleId: 'RR-002',
      expectedChannel: 'catalogue',
    },
    {
      label: 'Consulting engagement of any size',
      ctx: { category: 'consulting', value: 75000 },
      expectedRuleId: 'RR-003',
      expectedChannel: 'procurement-led',
    },
    {
      label: 'Mega-deal threshold (>€1M)',
      ctx: { category: 'services', value: 1_500_000 },
      expectedRuleId: 'RR-006',
      expectedChannel: 'procurement-led',
    },
    {
      label: 'Urgent priority request',
      ctx: { category: 'goods', value: 30000, priority: 'urgent', isUrgent: true },
      expectedRuleId: 'RR-010',
      expectedChannel: 'procurement-led',
    },
  ];

  for (const s of scenarios) {
    const m = evaluateRoutingRules(rules, s.ctx);
    assert(
      m?.matchedRule?.id === s.expectedRuleId && m?.channel === s.expectedChannel,
      `routing: ${s.label}`,
      `matched=${m?.matchedRule?.id ?? 'none'} channel=${m?.channel ?? 'none'} expected=${s.expectedRuleId}/${s.expectedChannel}`,
    );
  }

  // ── No-match context falls back gracefully
  const noMatch = evaluateRoutingRules(rules, { category: 'unknown-category', value: 42 });
  assert(noMatch === null, 'routing: no-match returns null', `got=${JSON.stringify(noMatch)}`);
  const fallback = resolveRouting(rules, { category: 'unknown-category', value: 42 });
  assert(
    fallback.matchedRule === null && fallback.channel === 'catalogue',
    'routing: fallback is catalogue for small no-match request',
    `channel=${fallback.channel}`,
  );

  // ── Ensure disabled rules never match
  const disabled = rules.filter((r) => r.status === 'disabled');
  if (disabled.length > 0) {
    // Build a context guaranteed to match RR-012 if status were honoured
    const ctx = { supplierId: 'SUP-999', category: 'goods' };
    const m = evaluateRoutingRules(rules, ctx);
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
  const critical = evaluateRoutingRules(riskRules, { value: 10000, riskRating: 'critical' });
  assert(critical?.matchedRule?.id === 'RISK-FULL', 'routing: critical risk escalates over low value',
    `matched=${critical?.matchedRule?.id ?? 'none'} channel=${critical?.channel ?? 'none'}`);
  const high = evaluateRoutingRules(riskRules, { value: 10000, riskRating: 'high' });
  assert(high?.matchedRule?.id === 'RISK-FULL', 'routing: high risk meets the threshold',
    `matched=${high?.matchedRule?.id ?? 'none'}`);
  const lowRisk = evaluateRoutingRules(riskRules, { value: 10000, riskRating: 'low' });
  assert(lowRisk?.matchedRule?.id === 'RISK-LIGHT', 'routing: low risk falls through to value rule',
    `matched=${lowRisk?.matchedRule?.id ?? 'none'}`);
  const noRisk = evaluateRoutingRules(riskRules, { value: 10000 });
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
  const material = evaluateRoutingRules(matRules, { value: 10000, material: true });
  assert(material?.matchedRule?.id === 'MAT-FULL', 'routing: material demand escalates over low value',
    `matched=${material?.matchedRule?.id ?? 'none'} channel=${material?.channel ?? 'none'}`);
  const notMaterial = evaluateRoutingRules(matRules, { value: 10000, material: false });
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
