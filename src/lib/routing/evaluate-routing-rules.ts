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
import type { PolicyConfig } from '@/lib/procurement/policy-config';
import { containsPolicyToken, resolvePolicyList } from '../procurement/policy-tokens.js';

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
}

/** Fields the evaluator can read. Kept in step with the admin editor's list. */
export const SUPPORTED_FIELDS = [
  'category', 'value', 'supplierId', 'commodityCode', 'priority',
  'isUrgent', 'riskRating', 'material', 'contractId', 'region',
] as const;

/** Operators the evaluator implements. Kept in step with the editor's list. */
export const SUPPORTED_OPERATORS = [
  'equals', 'not_equals', 'greater_than', 'less_than', 'in', 'starts_with',
  'between', 'risk_rating', 'contains', 'is_empty', 'is_not_empty',
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
/**
 * Fields the vocabulary supports and no production caller supplies.
 *
 * `diagnoseRule` used to check only the vocabulary, so a rule keyed on a field
 * nothing populates read as healthy. `commodityCode` sat here for months —
 * RR-007 and RR-009 were active, showed match counts of 62 and 24, and could
 * never fire. It is supplied now; `region` is not, because the demand model has
 * no such field yet.
 *
 * Anything listed here must be removed from the list the moment a caller starts
 * passing it, or the diagnostic becomes the false alarm instead.
 */
const UNPOPULATED_FIELDS: readonly string[] = ['region'];

/**
 * Substitute every `policy:<key>` token in a rule's conditions for the number
 * the decisioning-thresholds page governs. The one place a stored rule becomes
 * an evaluable rule.
 *
 * This is deliberately NOT done inside `evalCondition`. That function is pure
 * and shared with the Form Builder, and the two alternatives both fail:
 * reading the module-singleton active config would let a serverless caller
 * evaluate against shipped defaults while the admin's saved thresholds sat in
 * Neon — a wrong answer with no error — and passing the config down to each
 * comparison would still leave `diagnoseRule` and the rule summary needing
 * their own resolver, which is the duplication being removed.
 */
export function resolveRuleConditions(rule: RoutingRule, config: PolicyConfig): RoutingRule {
  if (!(rule.conditions ?? []).some((c) => containsPolicyToken(c.value))) return rule;
  return {
    ...rule,
    conditions: rule.conditions.map((c) => ({
      ...c,
      // `between` and `in` carry several bounds; each resolves on its own.
      value: resolvePolicyList(c.value, config).value,
    })),
  };
}

export function resolveRulesForEvaluation(rules: RoutingRule[], config: PolicyConfig): RoutingRule[] {
  return rules.map((r) => resolveRuleConditions(r, config));
}

/** What `diagnoseRule` needs beyond the rule itself. */
export interface DiagnoseContext {
  config: PolicyConfig;
  /** Ids of the configured approval chains, so a rule naming a chain that does
   *  not exist is reported rather than silently ignored at intake. */
  chainIds?: readonly string[];
}

export function diagnoseRule(rule: RoutingRule, ctx: DiagnoseContext): string[] {
  const problems: string[] = [];
  for (const c of rule.conditions ?? []) {
    if (UNPOPULATED_FIELDS.includes(c.field)) {
      problems.push(`Nothing supplies "${c.field}" yet, so this condition can never be true.`);
    }
    if (!(SUPPORTED_FIELDS as readonly string[]).includes(c.field)) {
      problems.push(`Unknown field "${c.field}" — this condition can never be true.`);
    }
    if (!(SUPPORTED_OPERATORS as readonly string[]).includes(c.operator)) {
      problems.push(`Unsupported operator "${c.operator}" on "${c.field}".`);
    }
    // A `policy:` token naming a key that does not exist keeps its raw value,
    // which then fails every numeric comparison — the same silent death an
    // unknown field used to have, so it gets the same visible diagnostic.
    const resolved = resolvePolicyList(c.value, ctx.config);
    if (resolved.unresolved) {
      problems.push(`Unknown governed threshold "${c.value}" — this condition can never be true.`);
    }
    // `between` needs two bounds; one silently fails every comparison. Checked
    // on the RESOLVED value, since a token stands in for one bound.
    if (c.operator === 'between' && resolved.value.split(',').length !== 2) {
      problems.push(`"${c.field} between ${c.value}" needs two comma-separated bounds.`);
    }
  }
  // The rule's approval chain is looked up as an approval_chains id at intake.
  // It held a role-path string for as long as the field existed, so the lookup
  // never matched and the value band always decided — silently.
  const chain = rule.action?.approvalChain;
  if (chain && ctx.chainIds && ctx.chainIds.length > 0 && !ctx.chainIds.includes(chain)) {
    problems.push(`"${chain}" is not a configured approval chain — the value band will decide instead.`);
  }
  if ((rule.conditions ?? []).length === 0) {
    problems.push('The rule has no conditions, so it can never match.');
  }
  return problems;
}

/** Every active rule that cannot fire, for the admin list. */
export function diagnoseRules(rules: RoutingRule[], ctx: DiagnoseContext): RuleDiagnostic[] {
  return rules
    .filter((r) => r.status === 'active')
    .map((r) => ({ ruleId: r.id, ruleName: r.name, problems: diagnoseRule(r, ctx) }))
    .filter((d) => d.problems.length > 0);
}

/**
 * Does any active rule catch a demand nothing specific matches?
 *
 * The catch-alls are ordinary editable rules now, so an admin can deactivate
 * the last one and leave a hole. Production still routes — `resolveRouting`
 * has a code floor — but silently, and a silent floor is the pattern this
 * tranche exists to remove. The rules page renders this before the admin saves.
 *
 * Deliberately a coverage question, not an id check: an admin who writes their
 * own always-true rule and deletes ours has not made a mistake.
 */
export function uncoveredDemand(
  rules: RoutingRule[],
  config: PolicyConfig,
): { category: string; value: number }[] {
  // A small probe set spanning the governed boundaries. Not exhaustive — it is
  // the smallest grid that fails when the always-true catch-all goes away.
  const probes = [
    { category: 'goods', value: 0 },
    { category: 'goods', value: config.competitiveSourcingThreshold },
    { category: 'goods', value: config.businessLedCeiling + 1 },
    { category: 'goods', value: config.budgetApprovalThreshold + 1 },
    { category: 'services', value: config.businessLedCeiling + 1 },
  ];
  return probes.filter((p) =>
    evaluateRoutingRules(rules, p, config) === null);
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
  catalogue: 'Catalogue',
  'business-led': 'Business-Led',
  'procurement-led': 'Procurement-Led Sourcing',
  'framework-call-off': 'Framework Call-Off',
};

export function buyingChannelLabel(channel: BuyingChannel): string {
  return BUYING_CHANNEL_LABELS[channel] ?? channel;
}

// The requester's wording for a channel ("Procurement runs a sourcing
// exercise") used to be a map here. It lives on the workflow template that
// claims the channel now — channelCopy() in lib/workflow/channel-stages.ts —
// so it is edited in the Workflow Designer with the lifecycle it describes.


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

/**
 * Exported so the Form Builder's trigger conditions use this evaluator rather
 * than a second one.
 *
 * The form evaluator was an inline `.some()` in step-detail-card.tsx that
 * implemented exactly one field/operator pair and returned `true` for anything
 * else — so one unrecognised condition made a whole set pass, and a form
 * configured "category equals software AND value greater_than 100000" fired on
 * every request. Precisely the failure this file's header describes fixing for
 * rules, in mirror image: `every` + `false` there, `some` + `true` here.
 */
export function evalCondition(
  field: string,
  operator: string,
  value: string,
  ctx: RoutingContext,
): boolean {
  // A token here means a caller evaluated a stored rule without passing it
  // through `resolveRuleConditions`. Returning false would look exactly like a
  // condition that legitimately did not match, which is the failure mode this
  // whole module exists to avoid.
  if (containsPolicyToken(value)) {
    console.error(`[evalCondition] unresolved ${value} — call resolveRuleConditions first.`);
    return false;
  }

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
    // The Form Builder has always offered this and the evaluator never had it,
    // so a `not_equals` condition fell to the default. Implemented rather than
    // dropped: "category is not software" is a reasonable thing to configure,
    // and the routing editor can use it too now.
    case 'not_equals':
      return String(actual) !== value;
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

/**
 * `config` is required rather than defaulted, deliberately. A default of
 * `getActivePolicyConfig()` reads as convenience and is a landmine: the active
 * config is a browser-boot singleton, so a serverless caller would silently
 * evaluate every rule against shipped defaults. Requiring it makes that
 * impossible to write by accident — the same argument `demand-channel.ts`
 * makes for its own inputs.
 */
export function evaluateRoutingRules(
  rules: RoutingRule[],
  ctx: RoutingContext,
  config: PolicyConfig,
): RoutingMatch | null {
  for (const rule of resolveRulesForEvaluation(rules, config)) {
    if (ruleMatches(rule, ctx)) {
      return { channel: rule.action.buyingChannel, approvalChain: rule.action.approvalChain, matchedRule: rule };
    }
  }
  return null;
}

/**
 * The channel used when no rule matches at all.
 *
 * Not configurable, deliberately. The catch-all rules (RR-900…RR-905) are
 * ordinary editable data, which means an admin can deactivate or delete them —
 * and intake must never be able to produce a request with no route. This is the
 * floor under that, and it logs, because reaching it means the rule set has a
 * hole somebody should close.
 *
 * It replaced a five-branch if-ladder that restated three governed thresholds
 * in code. That ladder is now RR-900…RR-905, where an admin can see it.
 */
export const CHANNEL_OF_LAST_RESORT: BuyingChannel = 'procurement-led';

export function resolveRouting(
  rules: RoutingRule[],
  ctx: RoutingContext,
  config: PolicyConfig,
): RoutingMatch {
  const match = evaluateRoutingRules(rules, ctx, config);
  if (match) return match;
  console.warn(
    '[resolveRouting] no rule matched — falling back to ' +
    `${CHANNEL_OF_LAST_RESORT}. The catch-all rules (RR-900…RR-905) should make ` +
    'this unreachable; one has probably been deactivated or deleted.',
  );
  return { channel: CHANNEL_OF_LAST_RESORT, approvalChain: '', matchedRule: null };
}
