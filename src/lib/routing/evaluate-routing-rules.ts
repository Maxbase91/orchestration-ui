// Routing-rule evaluation — which buying channel a demand takes.
//
// One rule about failure modes, learned the hard way. An unrecognised field or
// operator used to return `false`, and because a rule requires
// `conditions.every(...)`, a single unrecognised condition silently killed the
// whole rule. The admin editor offered THREE fields and THREE operators the
// evaluator did not implement, and the built-in Test panel implemented some of
// them itself — so an admin could write a rule, have the tester confirm it
// matched, and have it never fire in production.
//
// RR-001 "High-value IT software" sat active, first in evaluation order,
// described as routing software over EUR 100k to procurement-led, carrying a
// match_count of 42, with three conditions that could never all be true. It had
// never matched once.
//
// So: unknown fields and operators now produce a DIAGNOSTIC, surfaced on the
// rules page, rather than a quiet `false`. A rule that cannot fire must look
// broken, not merely inactive.

import type { RoutingRule, BuyingChannel, RiskRating } from '@/data/types';

export interface RoutingContext {
  category?: string;
  value?: number;
  supplierId?: string;
  commodityCode?: string;
  priority?: string;
  isUrgent?: boolean;
  /** Inherent risk tier of the demand (e.g. from the selected supplier). */
  riskRating?: RiskRating;
  /** Whether the demand is material (raises the regulatory/materiality flag). */
  material?: boolean;
  /**
   * The covering contract, when the intake pre-check found one. Known from
   * step 2 onward, which is what makes a `contractId` condition worth having:
   * "no contract covers this" is a real routing signal.
   */
  contractId?: string;
  /** Requester or delivery region, for geography-based routing. */
  region?: string;
  /** Eligibility must be proven separately before a rule may select P-card. */
  pCardEligible?: boolean;
}

/** Fields the evaluator can read. Kept in step with the admin editor's list. */
export const SUPPORTED_FIELDS = [
  'category', 'value', 'supplierId', 'commodityCode', 'priority',
  'isUrgent', 'riskRating', 'material', 'contractId', 'region',
] as const;

/** Operators the evaluator implements. Kept in step with the editor's list. */
export const SUPPORTED_OPERATORS = [
  'equals', 'greater_than', 'less_than', 'in', 'starts_with', 'between',
  'risk_rating', 'contains', 'is_empty', 'is_not_empty',
] as const;

/** Why a rule cannot fire. Empty means the rule is evaluable. */
export interface RuleDiagnostic {
  ruleId: string;
  ruleName: string;
  problems: string[];
}

/**
 * Conditions a rule carries that this evaluator cannot act on.
 *
 * Rendered on the rules page so a rule that can never match is visibly broken.
 * Returns [] for a healthy rule, so `diagnose(...).length > 0` reads as "this
 * rule is broken".
 */
export function diagnoseRule(rule: RoutingRule): string[] {
  const problems: string[] = [];
  for (const c of rule.conditions ?? []) {
    if (!(SUPPORTED_FIELDS as readonly string[]).includes(c.field)) {
      problems.push(`Unknown field "${c.field}" — this condition can never be true.`);
    }
    if (!(SUPPORTED_OPERATORS as readonly string[]).includes(c.operator)) {
      problems.push(`Unsupported operator "${c.operator}" on "${c.field}".`);
    }
    // `between` needs two bounds; one silently fails every comparison.
    if (c.operator === 'between' && c.value.split(',').length !== 2) {
      problems.push(`"${c.field} between ${c.value}" needs two comma-separated bounds.`);
    }
  }
  if ((rule.conditions ?? []).length === 0) {
    problems.push('The rule has no conditions, so it can never match.');
  }
  return problems;
}

/** Every active rule that cannot fire, for the admin list. */
export function diagnoseRules(rules: RoutingRule[]): RuleDiagnostic[] {
  return rules
    .filter((r) => r.status === 'active')
    .map((r) => ({ ruleId: r.id, ruleName: r.name, problems: diagnoseRule(r) }))
    .filter((d) => d.problems.length > 0);
}

/** Risk tiers ordered low → critical, for threshold comparisons. */
const RISK_ORDER: Record<RiskRating, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export interface RoutingMatch {
  channel: BuyingChannel;
  approvalChain: string;
  matchedRule: RoutingRule | null;
}

const BUYING_CHANNEL_LABELS: Record<BuyingChannel, string> = {
  catalogue: 'Catalogue / Direct PO',
  'direct-po': 'Direct PO',
  'business-led': 'Business-Led',
  'procurement-led': 'Procurement-Led Sourcing',
  'framework-call-off': 'Framework Call-Off',
  'p-card': 'P-card route',
};

export function buyingChannelLabel(channel: BuyingChannel): string {
  return BUYING_CHANNEL_LABELS[channel] ?? channel;
}

function fieldValue(ctx: RoutingContext, field: string): string | number | boolean | undefined {
  switch (field) {
    case 'category': return ctx.category;
    case 'value': return ctx.value;
    case 'supplierId': return ctx.supplierId;
    case 'commodityCode': return ctx.commodityCode;
    case 'priority': return ctx.priority;
    case 'isUrgent': return ctx.isUrgent;
    case 'riskRating': return ctx.riskRating;
    case 'material': return ctx.material;
    case 'contractId': return ctx.contractId;
    case 'region': return ctx.region;
    default: return undefined;
  }
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function evalCondition(
  field: string,
  operator: string,
  value: string,
  ctx: RoutingContext,
): boolean {
  const actual = fieldValue(ctx, field);

  // Emptiness is asked BEFORE the undefined guard, because "is empty" is a
  // question about absence — bailing on undefined would make it unanswerable,
  // which is exactly how `contractId is_empty` came to be permanently false.
  const empty = actual === undefined || actual === null || actual === '' || actual === false;
  if (operator === 'is_empty') return empty;
  if (operator === 'is_not_empty') return !empty;

  if (actual === undefined) return false;

  switch (operator) {
    case 'equals':
      return String(actual) === value;
    case 'greater_than': {
      const a = toNumber(actual);
      const b = toNumber(value);
      return a !== null && b !== null && a > b;
    }
    case 'less_than': {
      const a = toNumber(actual);
      const b = toNumber(value);
      return a !== null && b !== null && a < b;
    }
    case 'in': {
      const set = value.split(',').map((s) => s.trim());
      return set.includes(String(actual));
    }
    case 'starts_with':
      return String(actual).startsWith(value);
    case 'contains':
      return String(actual).toLowerCase().includes(value.toLowerCase());
    case 'between': {
      // A single bound is a malformed rule, not a half-open range — flagged by
      // diagnoseRule so it is visible rather than silently never matching.
      const [lo, hi] = value.split(',').map((s) => Number(s.trim()));
      const a = toNumber(actual);
      return a !== null && Number.isFinite(lo) && Number.isFinite(hi) && a >= lo && a <= hi;
    }
    case 'risk_rating': {
      // Threshold match: the demand's risk tier is at or above the rule's tier
      // (e.g. value 'high' matches actual 'high' or 'critical').
      const actualTier = RISK_ORDER[actual as RiskRating];
      const valueTier = RISK_ORDER[value as RiskRating];
      return actualTier !== undefined && valueTier !== undefined && actualTier >= valueTier;
    }
    default:
      return false;
  }
}

function ruleMatches(rule: RoutingRule, ctx: RoutingContext): boolean {
  if (rule.status !== 'active') return false;
  if (!rule.conditions || rule.conditions.length === 0) return false;
  return rule.conditions.every((c) => evalCondition(c.field, c.operator, c.value, ctx));
}

export function evaluateRoutingRules(
  rules: RoutingRule[],
  ctx: RoutingContext,
): RoutingMatch | null {
  for (const rule of rules) {
    if (ruleMatches(rule, ctx)) {
      // A configurable rule may nominate P-card, but the payment-adjacent
      // route is only safe when the intake has separately proven eligibility.
      // Skipping this match lets a later governed rule or the normal fallback
      // decide rather than silently offering an unsafe route.
      if (rule.action.buyingChannel === 'p-card' && ctx.pCardEligible !== true) continue;
      return { channel: rule.action.buyingChannel, approvalChain: rule.action.approvalChain, matchedRule: rule };
    }
  }
  return null;
}

/**
 * Fallback classifier used when no routing rule matches. Mirrors the legacy
 * hard-coded behaviour in step-compliance.tsx so the UI never ends up with
 * an empty channel.
 */
export function fallbackBuyingChannel(ctx: RoutingContext): { channel: BuyingChannel; approvalChain: string } {
  const value = ctx.value ?? 0;
  const category = ctx.category ?? '';
  if (value < 25000) return { channel: 'catalogue', approvalChain: 'line-manager' };
  if (category === 'consulting' || value > 100000) return { channel: 'procurement-led', approvalChain: 'category-manager > finance > vp-procurement' };
  if (category === 'contingent-labour') return { channel: 'framework-call-off', approvalChain: 'category-manager > finance' };
  if (value <= 50000) return { channel: 'business-led', approvalChain: 'category-manager' };
  return { channel: 'procurement-led', approvalChain: 'category-manager > finance > vp-procurement' };
}

export function resolveRouting(
  rules: RoutingRule[],
  ctx: RoutingContext,
): RoutingMatch {
  const match = evaluateRoutingRules(rules, ctx);
  if (match) return match;
  const fb = fallbackBuyingChannel(ctx);
  return { channel: fb.channel, approvalChain: fb.approvalChain, matchedRule: null };
}
