// Where a workflow node's branch for an outcome leads — the stage, the error
// path or the end the engine would reach — worked out from the template alone.
//
// A rejection goes where its template's Rejected branch goes (decided
// 2026-09-26). The engine walks the graph for a request that has a workflow
// instance; many requests have none (older rows, some call-offs), and the same
// answer is needed for them, and before anything is written for either — a
// template with no Rejected path must refuse the rejection, not record one the
// request cannot follow. getNextNodeIds decides each hop past the first, as it
// does in the engine. Pure, with relative '.js' specifiers, so the server can
// run it too.
import type { PolicyConfig } from '../procurement/policy-config.js';
import {
  conditionForEdge, edgeConditionHolds, getNextNodeIds, type EdgeCondition, type EdgeEvalContext,
} from './edge-conditions.js';
import { nodeToStatus } from './node-config.js';

export interface BranchNode {
  id: string;
  type?: string;
  label?: string;
}

export interface BranchTemplate {
  nodes: BranchNode[];
  edges: Array<{ source: string; target: string; label?: string; condition?: EdgeCondition | null }>;
}

/** Where a walk stops: somewhere a request can be. */
const TERMINAL_TYPES = new Set(['stage', 'error', 'end']);
/** A guard against a cycle of decisions, not a business rule. */
const MAX_HOPS = 20;

/**
 * The node the branch for `outcome` reaches from `fromNodeId`: the first stage,
 * error or end node past any decisions in between. Null when no exit of
 * `fromNodeId` is conditioned on this outcome — the engine would fall through to
 * the node's default exit there, which is not a branch for the outcome.
 */
export function branchTarget(
  template: BranchTemplate,
  fromNodeId: string,
  outcome: string,
  ctx: EdgeEvalContext,
  config: PolicyConfig,
): BranchNode | null {
  // An exit conditioned on the outcome itself. One conditioned on something
  // else that happens to hold — Validation's "Skip risk" — is where the node
  // goes anyway, not where this outcome sends it.
  const exit = template.edges
    .filter((edge) => edge.source === fromNodeId && conditionForEdge(edge)?.field === 'outcome')
    .find((edge) => edgeConditionHolds(edge, { ...ctx, outcome }, config));
  if (!exit) return null;
  let node = template.nodes.find((candidate) => candidate.id === exit.target);
  // Past the first hop the outcome no longer applies, as in the engine, where
  // it reaches only the exits of the node the caller resumed.
  for (let hops = 0; node && !TERMINAL_TYPES.has(node.type ?? 'stage') && hops < MAX_HOPS; hops++) {
    const [next] = getNextNodeIds(node.id, template.edges, undefined, ctx, config);
    node = next ? template.nodes.find((candidate) => candidate.id === next) : undefined;
  }
  return node && TERMINAL_TYPES.has(node.type ?? 'stage') ? node : null;
}

/**
 * The status a request takes on reaching a node, as the engine sets it: an
 * error path is Referred Back, the end is Completed, a stage is its own.
 */
export function statusAtNode(node: BranchNode): string {
  if (node.type === 'error') return 'referred-back';
  if (node.type === 'end') return 'completed';
  return nodeToStatus(node.label ?? '');
}
