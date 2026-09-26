// The stages a request will go through on its channel, worked out before it is
// submitted — the Channel page's "Step by step".
//
// Nothing here decides anything new. Two rules already decide a request's path,
// and this runs both of them:
//   1. where the server LANDS the request — `firstActionableStage` for intake,
//      `checkoutEntryStage` for a call-off — which the caller computes with the
//      same function the writer calls;
//   2. how the engine MOVES it from there — `getNextNodeIds`, the branch
//      function the engine itself calls, over the template's typed conditions.
// A preview that re-derived either would be a second opinion about the
// workflow, free to disagree with it. This is the workflow's own answer, asked
// early. (The Review step's preview was that second opinion: it overlaid risk
// and onboarding onto the template from flags, and picked its own approval
// chain.)
//
// A signal intake cannot know yet — whether the supplier is new, while nobody
// has been chosen — is walked both ways. A stage reached one way and not the
// other is conditional, and its condition is the branch's own, so "If the
// supplier is new" comes from the graph rather than from copy.
//
// Pure, with relative imports, so a node test drives it.
import type { RequestStatus } from '../../data/types.js';
import type { PolicyConfig } from '../procurement/policy-config.js';
import { resolvePolicyList } from '../procurement/policy-tokens.js';
import { formatCurrency } from '../format.js';
import { nodeToStatus, nodeIdForStatus } from './node-config.js';
import { conditionForEdge, getNextNodeIds, type EdgeCondition, type EdgeEvalContext } from './edge-conditions.js';

export interface PlanNode {
  id: string;
  type?: string;
  label?: string;
  role?: string;
  slaDays?: number | null;
  purpose?: string;
  /** What the requester does at this stage (Workflow Designer). */
  requesterAction?: string;
}

export interface PlanEdge {
  source: string;
  target: string;
  label?: string;
  condition?: EdgeCondition | null;
}

export interface PlanTemplate {
  id: string;
  nodes: PlanNode[];
  edges: PlanEdge[];
}

/** Whether, and why, a stage is on this request's path. */
export type StageApplicability =
  /** The stage the requester is completing now — intake. */
  | { kind: 'here' }
  /** On the path whatever happens. `condition` is the branch that put it there, when one did. */
  | { kind: 'applies'; condition?: EdgeCondition }
  /** On the path only if `condition` holds, and it names something not yet known. */
  | { kind: 'conditional'; condition: EdgeCondition }
  /**
   * Not on the path. `after` names the stage it can only follow, when that one
   * is skipped too; otherwise `condition` is what did not hold — a branch, or
   * the entry rule's condition for a stage the server lands the request past.
   */
  | { kind: 'skipped'; condition?: EdgeCondition; after?: string };

export interface PlannedStage {
  node: PlanNode;
  status: RequestStatus;
  applicability: StageApplicability;
}

export interface ChannelPlan {
  stages: PlannedStage[];
  /** The stage the request enters on submit; null when the template has none for it. */
  entry: PlannedStage | null;
  /** Stages that run whatever happens: `here` and `applies`. */
  applying: number;
  /** Stages that run only if something not yet known turns out so. */
  conditional: number;
  /** Working days of the stages that run whatever happens; null when none sets a target. */
  targetDays: number | null;
}

/** The boolean workflow signals intake may not know yet. */
export type UnknownSignal = 'riskRequired' | 'onboardingRequired' | 'contractAmendmentRequired';

export interface PlanInput {
  /** Where the server lands the request on submit. */
  entryStage: RequestStatus;
  /**
   * The condition the entry rule applies to each stage it can land a request
   * past — `INTAKE_ENTRY_CONDITIONS`, `CHECKOUT_ENTRY_CONDITIONS`. Declared
   * beside the rule, in the branch vocabulary, so a stage the server jumps is
   * explained in the same words as one a branch skips.
   */
  entryConditions?: Partial<Record<RequestStatus, EdgeCondition>>;
  /** What the branches read: request fields and workflow signals. */
  context: EdgeEvalContext;
  /** Signals not yet known; each is walked both ways. */
  unknown?: readonly UnknownSignal[];
}

// ── Order ───────────────────────────────────────────────────────────────────

/**
 * Every stage node the graph can reach, in the order it reaches them.
 *
 * Not the `nodes` array, which is authoring order (WF-001 lists Vendor
 * Onboarding last), and not breadth-first, which puts Approval before Vendor
 * Onboarding because Validation reaches Approval directly on its skip-risk
 * branch. A stage comes after everything that can lead to it; between two that
 * are both ready, the one the graph meets first. Error nodes and their edges
 * are left out — Referred Back is where a request waits, not a stage of its
 * channel, and its Resubmit edge is the graph's one cycle.
 */
export function stagesInGraphOrder(template: PlanTemplate): PlanNode[] {
  return nodesInGraphOrder(template).filter((node) => node.type === 'stage');
}

function nodesInGraphOrder(template: PlanTemplate): PlanNode[] {
  const errors = new Set(template.nodes.filter((n) => n.type === 'error').map((n) => n.id));
  const nodes = template.nodes.filter((n) => !errors.has(n.id));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges = template.edges.filter((e) => byId.has(e.source) && byId.has(e.target));
  const start = nodes.find((n) => n.type === 'start') ?? nodes[0];
  if (!start) return [];

  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
    outgoing.get(edge.source)!.push(edge.target);
  }

  // Discovery rank — breadth-first in edge declaration order — breaks ties.
  const rank = new Map<string, number>([[start.id, 0]]);
  const queue = [start.id];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const target of outgoing.get(id) ?? []) {
      if (!rank.has(target)) { rank.set(target, rank.size); queue.push(target); }
    }
  }

  // Any cycle the error nodes did not account for is cut at its back edge, so
  // the ordering below always terminates.
  const back = new Set<string>();
  const state = new Map<string, 'open' | 'done'>();
  const visit = (id: string) => {
    state.set(id, 'open');
    for (const target of outgoing.get(id) ?? []) {
      if (state.get(target) === 'open') back.add(`${id}>${target}`);
      else if (!state.has(target)) visit(target);
    }
    state.set(id, 'done');
  };
  visit(start.id);

  const forward = edges.filter((e) => rank.has(e.source) && !back.has(`${e.source}>${e.target}`));
  const indegree = new Map<string, number>([...rank.keys()].map((id) => [id, 0]));
  for (const edge of forward) indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);

  const ready = [...rank.keys()].filter((id) => indegree.get(id) === 0);
  const ordered: PlanNode[] = [];
  while (ready.length > 0) {
    ready.sort((a, b) => rank.get(a)! - rank.get(b)!);
    const id = ready.shift()!;
    ordered.push(byId.get(id)!);
    for (const edge of forward.filter((e) => e.source === id)) {
      const left = indegree.get(edge.target)! - 1;
      indegree.set(edge.target, left);
      if (left === 0) ready.push(edge.target);
    }
  }
  return ordered;
}

// ── The walk ────────────────────────────────────────────────────────────────

interface Walk {
  reached: Set<string>;
  /** The edge each reached node was entered by. */
  via: Map<string, PlanEdge>;
}

/**
 * The engine's path from the entry node, for one set of signals.
 *
 * `outcome: 'approved'` because this is the path of a request that goes ahead;
 * a rejection sends it to Referred Back, which is not a stage of the channel.
 */
function walkFrom(template: PlanTemplate, entryId: string, context: EdgeEvalContext, config: PolicyConfig): Walk {
  const reached = new Set<string>();
  const via = new Map<string, PlanEdge>();
  let id: string | undefined = entryId;
  while (id && !reached.has(id)) {
    reached.add(id);
    const from: string = id;
    const next: string | undefined = getNextNodeIds(from, template.edges, 'approved', context, config)[0];
    if (next && !via.has(next)) {
      via.set(next, template.edges.find((e) => e.source === from && e.target === next)!);
    }
    id = next;
  }
  return { reached, via };
}

/** Every combination of the unknown signals, as contexts to walk. */
function scenarios(context: EdgeEvalContext, unknown: readonly UnknownSignal[]): EdgeEvalContext[] {
  let out: EdgeEvalContext[] = [{ ...context }];
  for (const signal of unknown) {
    out = out.flatMap((ctx) => [{ ...ctx, [signal]: true }, { ...ctx, [signal]: false }]);
  }
  return out;
}

function sameCondition(a: EdgeCondition, b: EdgeCondition): boolean {
  return a.field === b.field && a.operator === b.operator && a.value === b.value;
}

/** A condition worth naming — the approve/reject outcome is the happy path, not a reason. */
function reasonOf(edge: PlanEdge | undefined): EdgeCondition | undefined {
  const condition = edge ? conditionForEdge(edge) : null;
  return condition && condition.field !== 'outcome' ? condition : undefined;
}

/**
 * The stages of `template` for one request: which run, which might, which do
 * not and why, with the entry the server will choose.
 */
export function planChannel(template: PlanTemplate, input: PlanInput, config: PolicyConfig): ChannelPlan {
  const order = nodesInGraphOrder(template);
  const position = new Map(order.map((node, index) => [node.id, index]));
  const stageNodes = order.filter((node) => node.type === 'stage');
  const start = order[0];
  const entryId = nodeIdForStatus(stageNodes, input.entryStage) ?? start?.id;
  if (!entryId) return { stages: [], entry: null, applying: 0, conditional: 0, targetDays: null };

  const unknown = input.unknown ?? [];
  const walks = scenarios(input.context, unknown).map((ctx) => walkFrom(template, entryId, ctx, config));

  const predecessors = (id: string) => template.edges.filter((e) => e.target === id && position.has(e.source));
  /** The nearest stages upstream of a node, looking through decisions. */
  const upstreamStages = (id: string, seen = new Set<string>()): PlanNode[] => predecessors(id).flatMap((edge) => {
    if (seen.has(edge.source)) return [];
    seen.add(edge.source);
    const source = order[position.get(edge.source)!];
    return source.type === 'stage' ? [source] : upstreamStages(source.id, seen);
  });

  const applicability = new Map<string, StageApplicability>();
  for (const node of stageNodes) {
    const status = nodeToStatus(node.label ?? '') as RequestStatus;
    if (status === 'intake') { applicability.set(node.id, { kind: 'here' }); continue; }

    const reaching = walks.filter((walk) => walk.reached.has(node.id));
    if (reaching.length === walks.length) {
      // The entry applies because the entry rule said so; any other stage
      // because of the branch into it — named only when every path takes the
      // same one, or Approval would read "applies · supplier already set up"
      // on the path that skipped onboarding.
      const ways = walks.map((walk) => reasonOf(walk.via.get(node.id)));
      const same = ways.every((way) => way && ways[0] && sameCondition(way, ways[0]));
      const condition = node.id === entryId
        ? input.entryConditions?.[status]
        : same && !(unknown as readonly string[]).includes(ways[0]!.field) ? ways[0] : undefined;
      applicability.set(node.id, { kind: 'applies', condition });
      continue;
    }
    if (reaching.length > 0) {
      // The unknown signal this stage turns on: the first branch on the way in
      // that tests one. Walked back along the path, because a stage reached
      // unconditionally from a conditional one inherits its condition.
      const walk = reaching[0];
      let condition: EdgeCondition | undefined;
      for (let at = node.id; at !== entryId && !condition;) {
        const edge = walk.via.get(at);
        if (!edge) break;
        const tested = conditionForEdge(edge);
        if (tested && (unknown as readonly string[]).includes(tested.field)) condition = tested;
        at = edge.source;
      }
      applicability.set(node.id, {
        kind: 'conditional',
        condition: condition ?? { field: unknown[0], operator: 'equals', value: 'true' },
      });
      continue;
    }
    applicability.set(node.id, { kind: 'skipped' });
  }

  // Why each skipped stage is skipped — after the loop above, because a stage
  // can only be explained by the fate of the ones before it.
  for (const node of stageNodes) {
    if (applicability.get(node.id)?.kind !== 'skipped') continue;
    const status = nodeToStatus(node.label ?? '') as RequestStatus;
    const upstream = upstreamStages(node.id);
    const upstreamSkipped = upstream.length > 0
      && upstream.every((stage) => applicability.get(stage.id)?.kind === 'skipped');
    if (upstreamSkipped) {
      applicability.set(node.id, { kind: 'skipped', after: upstream[0].label });
      continue;
    }
    // Before the entry: the server lands the request past it, for the reason
    // its entry rule declares.
    if ((position.get(node.id) ?? 0) < (position.get(entryId) ?? 0)) {
      applicability.set(node.id, { kind: 'skipped', condition: input.entryConditions?.[status] });
      continue;
    }
    // After it: a branch into it from a stage the request does reach did not hold.
    const branch = predecessors(node.id).find((edge) => walks[0].reached.has(edge.source) && reasonOf(edge));
    applicability.set(node.id, { kind: 'skipped', condition: reasonOf(branch) });
  }

  const stages = stageNodes.map((node) => ({
    node,
    status: nodeToStatus(node.label ?? '') as RequestStatus,
    applicability: applicability.get(node.id)!,
  }));
  const sure = stages.filter((s) => s.applicability.kind === 'here' || s.applicability.kind === 'applies');
  const targets = sure.map((s) => s.node.slaDays).filter((days): days is number => typeof days === 'number');
  return {
    stages,
    entry: stages.find((s) => s.node.id === entryId) ?? null,
    applying: sure.length,
    conditional: stages.filter((s) => s.applicability.kind === 'conditional').length,
    targetDays: targets.length > 0 ? targets.reduce((sum, days) => sum + days, 0) : null,
  };
}

// ── Words ───────────────────────────────────────────────────────────────────

export interface ApplicabilityHints {
  /** No new assessment because an existing one covers this — "reused" rather than "not needed". */
  riskReused?: boolean;
}

/** What each workflow signal means to a requester, held / not held / not yet known. */
const SIGNAL_WORDS: Record<UnknownSignal, { held: string; failed: string; unknown: string; unknownNot: string }> = {
  riskRequired: {
    held: 'risk assessment required', failed: 'no risk assessment needed',
    unknown: 'if a risk assessment is needed', unknownNot: 'if no risk assessment is needed',
  },
  onboardingRequired: {
    held: 'new supplier', failed: 'supplier already set up',
    unknown: 'if the supplier is new', unknownNot: 'if the supplier is already set up',
  },
  contractAmendmentRequired: {
    held: 'contract amended first', failed: 'contract used as it stands',
    unknown: 'if the contract must be amended', unknownNot: 'if the contract fits as it stands',
  },
};

function money(raw: string, config: PolicyConfig): string {
  const value = Number(resolvePolicyList(raw, config).value);
  return Number.isFinite(value) ? formatCurrency(value) : raw;
}

/**
 * A branch condition in the requester's words, as it turned out for them.
 *
 * The signals read as the thing they are about ("new supplier"); a value
 * comparison reads as an amount, resolved through the governed thresholds so
 * it moves with policy. Anything else falls back to the condition itself
 * rather than being dropped.
 */
export function describeCondition(
  condition: EdgeCondition,
  outcome: 'held' | 'failed' | 'unknown',
  config: PolicyConfig,
  hints: ApplicabilityHints = {},
): string {
  const signal = SIGNAL_WORDS[condition.field as UnknownSignal];
  if (signal) {
    // A signal read as "not true" inverts the sentence: "Skip risk" holding is
    // "no risk assessment needed".
    const negated = condition.operator === 'not_equals' || condition.operator === 'not_in'
      || condition.value.trim().toLowerCase() === 'false';
    if (outcome === 'unknown') return negated ? signal.unknownNot : signal.unknown;
    const effective = (outcome === 'held') !== negated ? 'held' : 'failed';
    if (effective === 'failed' && condition.field === 'riskRequired' && hints.riskReused) return 'existing assessment reused';
    return signal[effective];
  }
  if (condition.field === 'value') {
    const [low, high] = condition.value.split(',').map((part) => money(part.trim(), config));
    switch (condition.operator) {
      case 'greater_than': return outcome === 'failed' ? `up to ${low}` : `over ${low}`;
      case 'less_than': return outcome === 'failed' ? `${low} or more` : `under ${low}`;
      case 'between': return outcome === 'failed' ? `outside ${low}–${high}` : `${low}–${high}`;
      default: break;
    }
  }
  const verb = outcome === 'failed' ? 'is not' : 'is';
  return `${condition.field} ${verb} ${condition.value.replace(/,/g, ', ')}`;
}

/** The tag a stage row carries, or null when it simply applies. */
export function applicabilityTag(
  applicability: StageApplicability,
  config: PolicyConfig,
  hints: ApplicabilityHints = {},
): string | null {
  switch (applicability.kind) {
    case 'here': return 'You are here';
    case 'applies':
      return applicability.condition ? `Applies · ${describeCondition(applicability.condition, 'held', config, hints)}` : null;
    case 'conditional': {
      const text = describeCondition(applicability.condition, 'unknown', config, hints);
      return text.charAt(0).toUpperCase() + text.slice(1);
    }
    case 'skipped':
      if (applicability.after) return `Skipped · only after ${applicability.after}`;
      return applicability.condition
        ? `Skipped · ${describeCondition(applicability.condition, 'failed', config, hints)}`
        : 'Skipped';
  }
}

/** What a submit will do next, from the stage the request enters and who owns it. */
export function submitNoteFor(plan: ChannelPlan | null, noun: string): string {
  const entry = plan?.entry?.node;
  if (!entry) return `Submitting creates the ${noun}.`;
  return `Submitting creates the ${noun} and sends it to ${entry.label}${entry.role ? ` (${entry.role})` : ''}.`;
}

/** "9 of 11", or "9+ of 11" when more may run once something is known. */
export function applyCountLabel(plan: ChannelPlan): string {
  return `${plan.applying}${plan.conditional > 0 ? '+' : ''} of ${plan.stages.length}`;
}
