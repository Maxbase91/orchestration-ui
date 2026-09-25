// The one place a governed threshold is named instead of restated.
//
// Five surfaces used to express "value >= X" independently: the policy config,
// routing-rule conditions, a hard-coded if-ladder in the routing fallback,
// approval-chain band strings, and workflow edge labels. Only the first was
// governed. €25,000 appeared in four of them and €100,000 in five, unlinked, so
// moving one moved one — and db/backfills/2026-08-28-rr001-repair.sql records
// what that costs: RR-001 was dead for months and nobody noticed, because the
// hard-coded ladder happened to agree with it. The duplication did not add
// safety; it hid the outage.
//
// A `policy:<key>` token lets every other surface reference a number the
// decisioning-threshold page owns. The mechanism already existed for
// service-description slots (`resolveConditionValue`, moved here) — this
// generalises it and gives it a vocabulary the admin UI can offer and diagnose.
//
// Resolution happens at the READ BOUNDARY, never inside an evaluator: see
// evaluate-routing-rules.ts's `resolveRuleConditions` for why.
import { type PolicyConfig, DEFAULT_POLICY_CONFIG } from './policy-config.js';

export const POLICY_TOKEN_PREFIX = 'policy:';

/** Keys holding a single number — the ones a condition can compare against. */
export type NumericPolicyKey = {
  [K in keyof PolicyConfig]: PolicyConfig[K] extends number ? K : never;
}[keyof PolicyConfig];

/** Keys holding a list of category ids. */
export type CategoryListPolicyKey = {
  [K in keyof PolicyConfig]: PolicyConfig[K] extends string[] ? K : never;
}[keyof PolicyConfig];

/** Admin-facing name for each category-list key, rendered as a checklist of
 *  the configured categories. Same contract as POLICY_KEY_META: a list key with
 *  no entry here fails test:policy-tokens instead of becoming uneditable. */
export const CATEGORY_LIST_POLICY_META: Record<CategoryListPolicyKey, { label: string; help: string }> = {
  competitiveSourcingExemptCategories: {
    label: 'Exempt from competitive quotes',
    help: 'Demand in these categories passes the competitive-sourcing check whatever its value.',
  },
  privilegedAccessCategories: {
    label: 'Ask about privileged access',
    help: 'Intake asks whether the engagement grants privileged or system access for these categories, whatever the data sensitivity.',
  },
};

export const CATEGORY_LIST_POLICY_KEYS: readonly CategoryListPolicyKey[] =
  Object.keys(CATEGORY_LIST_POLICY_META) as CategoryListPolicyKey[];

/** Admin-facing name and unit for one key. This is the single copy: the
 *  decisioning-thresholds page renders it, and the routing and form condition
 *  editors offer it. A key added to PolicyConfig without an entry here fails
 *  test:policy-tokens rather than silently becoming uneditable — which is how
 *  delegatedAuthorityThreshold came to be live, server-validated and impossible
 *  to change for as long as it existed.
 *
 *  `usedIn` names where the platform's own code uses the number, in the words
 *  of the screens it shows up on (`help` already says what it does). The
 *  configuration that names a key — a routing rule, an approval-chain band, a
 *  workflow branch — is not listed here: the page reads it live, because an
 *  admin can add or remove it. Empty means no code reads the key; only
 *  configuration can make it matter. test:policy-tokens holds both ways. */
export const POLICY_KEY_META: Record<NumericPolicyKey, { label: string; help: string; unit: '€' | '%' | '/100' | 'days' | ''; usedIn: string }> = {
  catalogueAutoApprovalThreshold: { label: 'Catalogue auto-approval threshold', help: 'Up to this whole-request value, valid catalogue orders are auto-approved', unit: '€', usedIn: 'Catalogue checkout · Home answers' },
  approvalFullThreshold: { label: 'Full approval-to-source threshold', help: 'At/above this value the full approval gate applies', unit: '€', usedIn: 'Review & submit — the approval-to-source gate' },
  materialityValueThreshold: { label: 'Materiality value threshold', help: 'At/above this value a demand is material on size alone', unit: '€', usedIn: 'Review & submit — materiality' },
  criticalServiceThreshold: { label: 'Critical-service question threshold', help: 'At/above this value the critical-service question is asked', unit: '€', usedIn: 'Describe — the critical-service and commercial-model questions' },
  continuityThreshold: { label: 'Business-continuity threshold', help: 'At/above this value continuity dependence is non-trivial', unit: '€', usedIn: 'Describe — the dependencies question · Review & submit — continuity risk' },
  riskHighValue: { label: 'Inherent-risk band — high', help: 'Value contributing to a high inherent tier', unit: '€', usedIn: 'Review & submit — inherent risk' },
  riskMediumValue: { label: 'Inherent-risk band — medium', help: 'Value contributing to a medium inherent tier', unit: '€', usedIn: 'Review & submit — inherent risk' },
  competitiveSourcingThreshold: { label: 'Competitive-sourcing threshold', help: 'At/above this value competitive sourcing applies', unit: '€', usedIn: 'Review & submit — the competitive-sourcing check · Home answers' },
  contractRequiredThreshold: { label: 'Contract-required threshold', help: 'At/above this value a PO needs an executed contract behind it', unit: '€', usedIn: 'Review & submit — the contract-before-PO check · Analytics — spend anomalies' },
  budgetApprovalThreshold: { label: 'Budget approval threshold', help: 'Above this value the demand exceeds standard budget approval and needs VP sign-off', unit: '€', usedIn: 'Review & submit — the budget approval check · Analytics — spend anomalies' },
  businessLedCeiling: { label: 'Business-led ceiling', help: 'At/below this value an unmatched demand is bought by the business rather than run by procurement', unit: '€', usedIn: 'Home answers' },
  delegatedAuthorityThreshold: { label: 'Delegated authority threshold', help: 'Above this value the demand exceeds normal delegated budget authority', unit: '€', usedIn: '' },
  minCompetitiveQuotes: { label: 'Minimum competitive quotes', help: 'Quotes required above the competitive-sourcing threshold', unit: '', usedIn: 'Review & submit — the competitive-sourcing check · Home answers' },
  preferredMinPerformance: { label: 'Preferred-supplier performance bar', help: 'Minimum performance score to qualify as preferred', unit: '/100', usedIn: 'Supplier recommendations · Review & submit — the preferred-supplier check' },
  contractUtilisationHeadroom: { label: 'Contract utilisation headroom', help: 'Below this %, an active contract is transactable', unit: '%', usedIn: 'Review & submit — the contract check' },
  directCallOffLimit: { label: 'Direct call-off limit', help: 'Above this value a contract call-off needs a mini-competition, so it goes in as a new request', unit: '€', usedIn: 'How you’ll buy — contract call-offs · call-off checkout' },
  contractExpiryBufferDays: { label: 'Contract expiry buffer', help: 'Days-to-expiry that flag a contract as expiring', unit: 'days', usedIn: 'Review & submit — the contract check' },
  catalogueMatchThreshold: { label: 'Catalogue match threshold', help: 'Minimum score for a catalogue item to be offered at intake', unit: '', usedIn: 'How you’ll buy and Home — catalogue matching' },
  catalogueMinContentMatches: { label: 'Catalogue naming-word matches', help: 'Naming words (not adjectives) a catalogue match must hit', unit: '', usedIn: 'How you’ll buy and Home — catalogue matching' },
};

export const NUMERIC_POLICY_KEYS: readonly NumericPolicyKey[] =
  Object.keys(POLICY_KEY_META) as NumericPolicyKey[];

/** Keys denominated in currency — what a `value` condition should offer. */
export const CURRENCY_POLICY_KEYS: readonly NumericPolicyKey[] =
  NUMERIC_POLICY_KEYS.filter((k) => POLICY_KEY_META[k].unit === '€');

export function isPolicyToken(raw: string): boolean {
  return raw.startsWith(POLICY_TOKEN_PREFIX);
}

/**
 * Does this value carry a token ANYWHERE, including as one bound of a list?
 *
 * `isPolicyToken` only looks at the start, which is right for a single value
 * and wrong for `between`: "0,policy:businessLedCeiling" does not start with
 * the prefix, so the rule was never resolved and `Number('policy:…')` made
 * every comparison false. Exactly the silent-never-matches failure the tokens
 * exist to remove — reintroduced by the fast path that skipped resolution.
 */
export function containsPolicyToken(raw: string): boolean {
  return raw.split(',').some((part) => isPolicyToken(part.trim()));
}

export function policyToken(key: NumericPolicyKey): string {
  return `${POLICY_TOKEN_PREFIX}${key}`;
}

export interface ResolvedPolicyValue {
  /** What the evaluator compares against. */
  value: string;
  /** The key this came from, or null when the author wrote a literal. */
  key: NumericPolicyKey | null;
  /** A `policy:` token naming a key that does not exist. */
  unresolved: boolean;
}

/**
 * Substitute a governed number for its token. A literal passes through.
 *
 * An unknown key keeps the raw string — which then fails every numeric
 * comparison, exactly as it does today — but reports `unresolved`, so the
 * diagnostics can say so instead of the condition just never matching.
 */
export function resolvePolicyValue(raw: string, config: PolicyConfig): ResolvedPolicyValue {
  if (!isPolicyToken(raw)) return { value: raw, key: null, unresolved: false };
  const key = raw.slice(POLICY_TOKEN_PREFIX.length) as NumericPolicyKey;
  const resolved = (config as unknown as Record<string, unknown>)[key];
  if (typeof resolved !== 'number') return { value: raw, key: null, unresolved: true };
  return { value: String(resolved), key, unresolved: false };
}

/** Resolve each comma-separated part, for `between` and `in`. */
export function resolvePolicyList(raw: string, config: PolicyConfig): ResolvedPolicyValue {
  if (!raw.includes(',')) return resolvePolicyValue(raw, config);
  const parts = raw.split(',').map((p) => resolvePolicyValue(p.trim(), config));
  return {
    value: parts.map((p) => p.value).join(','),
    key: parts.find((p) => p.key)?.key ?? null,
    unresolved: parts.some((p) => p.unresolved),
  };
}

const NUMBER_FORMAT = new Intl.NumberFormat('en-GB');

/** "€25,000 — competitive-sourcing threshold", for rule summaries and band labels. */
export function describePolicyValue(resolved: ResolvedPolicyValue): string {
  if (resolved.unresolved) return `${resolved.value} (unknown threshold)`;
  if (!resolved.key) return resolved.value;
  const meta = POLICY_KEY_META[resolved.key];
  const n = Number(resolved.value);
  const amount = Number.isFinite(n)
    ? `${meta.unit === '€' ? '€' : ''}${NUMBER_FORMAT.format(n)}${meta.unit === '€' ? '' : meta.unit}`
    : resolved.value;
  return `${amount} — ${meta.label.toLowerCase()}`;
}

/**
 * A governed key holding exactly this number, if one does. Used by the editors
 * to nudge an admin typing a literal that a threshold already owns; deliberately
 * a suggestion and not a rewrite, because two controls sharing a number today
 * are not necessarily the same fact. Currency keys only — an amount is never
 * the same fact as a day count or a percentage.
 */
export function policyKeyHolding(value: number, config: PolicyConfig = DEFAULT_POLICY_CONFIG): NumericPolicyKey | null {
  return CURRENCY_POLICY_KEYS.find((k) => (config as unknown as Record<string, number>)[k] === value) ?? null;
}
