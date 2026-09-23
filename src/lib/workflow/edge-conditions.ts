// What decides which way a decision node branches.
//
// Edges carried a free-text `label` that the engine tried to parse. It handled
// a few shapes — `approved`, `risk required`, `value > 100000` — and returned
// false for everything else, and `getNextNodeIds` then silently took the first
// outgoing edge. So WF-002's `> €5K` / `< €5K` decision, written exactly as an
// admin would write it, never evaluated once: no field name, a currency symbol
// on the right-hand side, no match. Every catalogue order took the Manager
// Approval branch regardless of value, and nothing said so.
//
// A branch is now a typed condition in the same `{field, operator, value}`
// shape routing rules and form triggers use, resolved through the same
// evaluator and the same governed thresholds. The label goes back to being what
// it reads like on the canvas: a caption.
//
// Labels are still honoured for the workflow SIGNALS, because those are not
// request fields and never were — `approved` is the outcome of the step that
// just ran, and `risk required` is a decision intake already took. Those have
// their own field names in the vocabulary below, so an admin can write them
// either way and the engine reads one thing.
import type { PolicyConfig } from '../procurement/policy-config.js';
import { evalCondition, SUPPORTED_FIELDS, SUPPORTED_OPERATORS } from '../routing/evaluate-routing-rules.js';
import { resolvePolicyList } from '../procurement/policy-tokens.js';

export interface EdgeCondition {
  field: string;
  operator: string;
  value: string;
}

/**
 * Signals an edge can branch on that a request record does not carry.
 *
 * `outcome` is what the step that just ran returned; the two flags are
 * decisions taken earlier in the lifecycle. They are part of the vocabulary so
 * the designer can offer them, and so `diagnoseTemplate` can tell a typo from a
 * legitimate signal.
 */
export const EDGE_SIGNAL_FIELDS = ['outcome', 'riskRequired', 'onboardingRequired', 'contractAmendmentRequired'] as const;

const SIGNAL_FIELD_SET: ReadonlySet<string> = new Set(EDGE_SIGNAL_FIELDS);

/**
 * A workflow signal — the action's outcome, riskRequired, onboardingRequired,
 * contractAmendmentRequired — evaluated here, not by the routing evaluator.
 *
 * These went to `evalCondition`, whose field lookup knows only the routing
 * vocabulary (category, value, supplier, …) and answers `undefined` for
 * anything else, so EVERY signal condition was false. The engine then fell
 * through to a node's first edge: an approval stage took "Approved" whatever
 * the approver decided — a rejected request moved on to the next stage — and
 * risk and onboarding were entered whatever the triage said. The labels read
 * correctly on the canvas the whole time.
 */
function signalHolds(condition: EdgeCondition, ctx: EdgeEvalContext | undefined): boolean {
  const raw = (ctx as Record<string, unknown> | undefined)?.[condition.field];
  // Booleans compare as 'true' / 'false'; an absent signal is false, so
  // "Skip risk" (not_equals 'true') holds when nobody asked for a review.
  const actual = typeof raw === 'boolean' ? String(raw) : raw == null ? (condition.field === 'outcome' ? '' : 'false') : String(raw);
  const wanted = condition.value.split(',').map((v) => v.trim().toLowerCase());
  const a = actual.toLowerCase();
  switch (condition.operator) {
    case 'equals': return a === wanted[0];
    case 'not_equals': return a !== wanted[0];
    case 'in': return wanted.includes(a);
    case 'not_in': return !wanted.includes(a);
    default: return false;
  }
}

/** Everything an edge condition may name: request fields plus workflow signals. */
export const EDGE_FIELDS: readonly string[] = [...SUPPORTED_FIELDS, ...EDGE_SIGNAL_FIELDS];
export const EDGE_OPERATORS: readonly string[] = SUPPORTED_OPERATORS;

/** What an edge is evaluated against. */
export interface EdgeEvalContext {
  value?: number;
  category?: string;
  status?: string;
  outcome?: string;
  riskRequired?: boolean;
  onboardingRequired?: boolean;
  /** The governed checkout found the contract must be amended before this call-off fits it. */
  contractAmendmentRequired?: boolean;
  riskTier?: string;
  supplierId?: string;
  contractId?: string;
  commodityCode?: string;
  priority?: string;
  isUrgent?: boolean;
}

/**
 * The labels the engine has always understood as signals.
 *
 * Kept so existing templates keep working — an admin who wrote "Approved" on an
 * edge meant something real and the graph still reads. New edges should carry a
 * typed condition; `diagnoseTemplate` flags a label that looks like a
 * comparison but is not one of these and has no condition behind it.
 */
const SIGNAL_LABELS: Record<string, EdgeCondition> = {
  approved: { field: 'outcome', operator: 'equals', value: 'approved' },
  rejected: { field: 'outcome', operator: 'equals', value: 'rejected' },
  cancelled: { field: 'outcome', operator: 'equals', value: 'cancelled' },
  'risk required': { field: 'riskRequired', operator: 'equals', value: 'true' },
  'skip risk': { field: 'riskRequired', operator: 'not_equals', value: 'true' },
  'no risk assessment': { field: 'riskRequired', operator: 'not_equals', value: 'true' },
  'onboarding required': { field: 'onboardingRequired', operator: 'equals', value: 'true' },
  'skip onboarding': { field: 'onboardingRequired', operator: 'not_equals', value: 'true' },
  'no onboarding': { field: 'onboardingRequired', operator: 'not_equals', value: 'true' },
  'contract amendment required': { field: 'contractAmendmentRequired', operator: 'equals', value: 'true' },
  'no contract amendment': { field: 'contractAmendmentRequired', operator: 'not_equals', value: 'true' },
};

/** The condition an edge actually evaluates: the typed one, else a known signal label. */
export function conditionForEdge(
  edge: { label?: string; condition?: EdgeCondition | null },
): EdgeCondition | null {
  if (edge.condition?.field) return edge.condition;
  const key = (edge.label ?? '').trim().toLowerCase();
  return SIGNAL_LABELS[key] ?? null;
}

/**
 * Does this edge's condition hold?
 *
 * An edge with no condition and no recognised signal label is *unconditional* —
 * it matches. That is the honest reading of an unlabelled edge, and it is what
 * makes "exactly one unconditional edge" a usable default branch.
 */
export function edgeConditionHolds(
  edge: { label?: string; condition?: EdgeCondition | null },
  ctx: EdgeEvalContext,
  config: PolicyConfig,
): boolean {
  const condition = conditionForEdge(edge);
  if (!condition) return true;
  if (SIGNAL_FIELD_SET.has(condition.field)) return signalHolds(condition, ctx);
  return evalCondition(
    condition.field,
    condition.operator,
    // The same governed thresholds routing rules and form triggers use, so a
    // branch boundary moves with policy instead of being restated on a canvas.
    resolvePolicyList(condition.value, config).value,
    ctx as Record<string, unknown>,
  );
}

/** True when the edge carries nothing to evaluate — the default branch. */
export function isUnconditional(edge: { label?: string; condition?: EdgeCondition | null }): boolean {
  return conditionForEdge(edge) === null;
}

/**
 * A label that reads like a condition but is not one.
 *
 * `> €5K` is the case this exists for: it looks like a rule to whoever wrote
 * it, evaluates to nothing, and the branch it guards was taken unconditionally
 * for as long as it existed.
 */
export function labelLooksLikeCondition(label: string | undefined): boolean {
  if (!label) return false;
  const key = label.trim().toLowerCase();
  if (SIGNAL_LABELS[key]) return false;
  return /[<>=]|\bequals\b|\bover\b|\bunder\b|\babove\b|\bbelow\b|[€$£]\s*\d|\d/.test(key);
}

export interface TemplateDiagnostic {
  nodeId: string;
  problems: string[];
}

/**
 * Branches that cannot do what their caption says.
 *
 * The case this exists for is WF-002: a decision node whose two edges read
 * `> €5K` and `< €5K`, neither of which evaluated, so the first was taken every
 * time and the value was never consulted. Nothing anywhere said so — the
 * canvas showed a decision, the engine took a branch, and the two had no
 * relationship.
 */
export function diagnoseTemplate(
  template: {
    nodes: Array<{ id: string; type?: string; label?: string }>;
    edges: Array<{ source: string; target: string; label?: string; condition?: EdgeCondition | null }>;
  },
  config: PolicyConfig,
): TemplateDiagnostic[] {
  const out: TemplateDiagnostic[] = [];
  const byNode = new Map<string, string[]>();
  const add = (nodeId: string, problem: string) => {
    if (!byNode.has(nodeId)) byNode.set(nodeId, []);
    byNode.get(nodeId)!.push(problem);
  };

  for (const edge of template.edges ?? []) {
    const target = template.nodes.find((n) => n.id === edge.target)?.label ?? edge.target;
    if (edge.condition?.field) {
      if (!EDGE_FIELDS.includes(edge.condition.field)) {
        add(edge.source, `Branch to "${target}" tests "${edge.condition.field}", which nothing supplies.`);
      }
      if (!EDGE_OPERATORS.includes(edge.condition.operator)) {
        add(edge.source, `Branch to "${target}" uses the operator "${edge.condition.operator}", which is not implemented.`);
      }
      if (resolvePolicyList(edge.condition.value, config).unresolved) {
        add(edge.source, `Branch to "${target}" names a governed threshold that does not exist.`);
      }
      continue;
    }
    if (labelLooksLikeCondition(edge.label)) {
      add(edge.source, `Branch to "${target}" is labelled "${edge.label}" but carries no condition, so it is taken unconditionally.`);
    }
  }

  // Every node, not only decisions: the engine follows exactly one branch out
  // of ANY node. This was checked for `decision` nodes alone, so a `parallel`
  // split (WF-003's three checks, of which only the first ever ran) and a
  // stage with two captioned exits passed — and nothing ran it over the
  // shipped templates, which is how WF-001's "Needs Approval" / "Direct to
  // Sourcing" fork kept Sourcing unreachable. test:edge-conditions now does.
  for (const node of template.nodes ?? []) {
    const outgoing = (template.edges ?? []).filter((e) => e.source === node.id);
    if (node.type === 'decision' && outgoing.length === 0) {
      add(node.id, 'This decision has no outgoing branches, so nothing can follow it.');
      continue;
    }
    const unconditional = outgoing.filter(isUnconditional);
    // A decision every branch of which is conditional has no default, so a
    // request matching none falls through to whichever edge happens to be first.
    if (node.type === 'decision' && unconditional.length === 0) {
      add(node.id, 'Every branch has a condition, so a request matching none falls through to the first. Leave one unconditional as the default.');
      continue;
    }
    if (outgoing.length < 2) continue;
    if (node.type === 'parallel') {
      add(node.id, 'Branches here do not run in parallel — the engine follows one. Put the steps in sequence.');
    }
    if (unconditional.length > 1) {
      // The first unconditional edge is the default and the rest are
      // unreachable. Saying "arbitrary" would be wrong — it is deterministic,
      // just invisible — and naming the unreachable branches is what an admin
      // needs to see.
      const [, ...unreachable] = unconditional;
      const names = unreachable
        .map((e) => template.nodes.find((n) => n.id === e.target)?.label ?? e.target)
        .map((n) => `"${n}"`)
        .join(', ');
      add(node.id, `${names} can never be reached: ${unreachable.length === 1 ? 'it has' : 'they have'} no condition, and an earlier branch with no condition is always taken. Give ${unreachable.length === 1 ? 'it' : 'them'} a condition, or remove ${unreachable.length === 1 ? 'it' : 'them'}.`);
    }
  }

  // An approval that can be approved must be able to be rejected. WF-004's
  // Approval had only an "Approved" exit; a rejection matched nothing and fell
  // through to it, so a rejected renewal went on to Contract Execution.
  for (const node of template.nodes ?? []) {
    const exits = (template.edges ?? []).filter((e) => e.source === node.id);
    const outcomes = exits.map((e) => conditionForEdge(e)).filter((c) => c?.field === 'outcome').map((c) => c!.value);
    if (outcomes.includes('approved') && !outcomes.includes('rejected')) {
      add(node.id, 'This step can be approved but has no "Rejected" branch, so a rejection falls through to the approved path.');
    }
  }

  for (const [nodeId, problems] of byNode) out.push({ nodeId, problems });
  return out;
}

/**
 * Which node(s) follow this one.
 *
 * Lives here rather than in the engine because it is pure branch selection and
 * because the engine's `@/` aliases cannot be resolved outside the bundler — so
 * a test importing it there would have had to reimplement it, which is how the
 * `> €5K` decision went unnoticed in the first place.
 */
export function getNextNodeIds(
  nodeId: string,
  edges: Array<{ source: string; target: string; label?: string; condition?: EdgeCondition | null }>,
  outcome: string | undefined,
  ctx: EdgeEvalContext | undefined,
  config: PolicyConfig,
): string[] {
  const outgoing = edges.filter((e) => e.source === nodeId);
  if (outgoing.length === 0) return [];

  const evalCtx = { ...ctx, outcome } as EdgeEvalContext;

  // Conditioned edges are offered the decision first, in declaration order, so
  // "Risk required" is asked before the "Skip risk" catch-all beside it.
  const conditioned = outgoing.filter((e) => !isUnconditional(e));
  const matched = conditioned.find((e) => edgeConditionHolds(e, evalCtx, config));
  if (matched) return [matched.target];

  // Nothing matched. An unconditional edge is the author's default branch and
  // the right answer here; more than one is ambiguous and reported.
  const unconditional = outgoing.filter(isUnconditional);
  if (unconditional.length === 1) return [unconditional[0].target];
  if (unconditional.length > 1) {
    console.warn(
      `[engine] node ${nodeId} has ${unconditional.length} unconditional outgoing edges — ` +
      `taking ${unconditional[0].target}. Give all but one a condition.`,
    );
    return [unconditional[0].target];
  }

  // Every edge carries a condition and none held. Taking the first is what this
  // always did; the difference is that it now says so, because that is the
  // shape of the WF-002 defect — a decision node whose branches never
  // evaluated, silently always taking the same one.
  console.warn(
    `[engine] node ${nodeId}: no outgoing edge condition matched and there is no ` +
    `unconditional branch — falling through to ${outgoing[0].target}.`,
  );
  return [outgoing[0].target];
}
