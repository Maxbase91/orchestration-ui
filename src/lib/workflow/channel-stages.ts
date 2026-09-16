// The lifecycle a buying channel traverses, derived from its workflow template.
//
// Two things defined this and they disagreed. `buying-channel-stages.ts` said
// which stages a channel visits, in code; the workflow templates defined the
// graph the engine actually walks, in data. Renaming a stage in the Workflow
// Designer changed the graph and not the map, and the map is what the stepper
// draws and what `nextStageAfter` moves a request along.
//
// Templates win, because they are the thing an admin can see and change. This
// module derives the map from them.
//
// Deliberately dependency-free beyond node-config and the domain types, so the
// serverless handlers can use it: `api/_domains/intake-submit.ts` already reads
// `workflow_templates`, and the '@/'-aliased imports Vercel cannot resolve at
// runtime are exactly why the file it replaces carried the same constraint.
import type { BuyingChannel, RequestStatus } from '../../data/types.js';
import { nodeToStatus } from './node-config.js';

export type ChannelStageMap = Readonly<Record<string, readonly RequestStatus[]>>;

export interface TemplateLike {
  id: string;
  channels?: string[] | null;
  nodes: Array<{ id: string; type?: string; label?: string }>;
  edges: Array<{ source: string; target: string; label?: string }>;
}

/**
 * The stages this template's graph reaches, in the order it reaches them.
 *
 * Breadth-first from the `start` node, following EDGES in declaration order —
 * not the `nodes` array, which is authoring order and disagrees: WF-001 lists
 * `n14` (Risk Assessment) third while the graph reaches it after `n3`.
 *
 * Only `type: 'stage'` nodes contribute. An `error` node is not a lifecycle
 * stage — `referred-back` is somewhere a request can sit, but no channel
 * "traverses" it — and a decision or parallel node is structure, not a stage.
 *
 * Cycle-safe: WF-001's referred-back edge points back at intake.
 */
export function stagesFromTemplate(template: TemplateLike): RequestStatus[] {
  const byId = new Map(template.nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, string[]>();
  for (const edge of template.edges ?? []) {
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
    outgoing.get(edge.source)!.push(edge.target);
  }

  const start = template.nodes.find((n) => n.type === 'start') ?? template.nodes[0];
  if (!start) return [];

  const seenNodes = new Set<string>([start.id]);
  const queue: string[] = [start.id];
  const stages: RequestStatus[] = [];
  const seenStages = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = byId.get(id);
    if (node?.type === 'stage' && typeof node.label === 'string') {
      const status = nodeToStatus(node.label);
      // Two nodes can normalise to one stage — WF-002 has both "Auto-PO" and
      // "PO Created", which are both `po`. The stage is listed once.
      if (!seenStages.has(status)) {
        seenStages.add(status);
        stages.push(status as RequestStatus);
      }
    }
    for (const target of outgoing.get(id) ?? []) {
      if (seenNodes.has(target)) continue;
      seenNodes.add(target);
      queue.push(target);
    }
  }
  return stages;
}

/**
 * Channel → stages, from every template that claims a channel.
 *
 * A template with no `channels` is a side process, not a route: WF-003
 * (Supplier Onboarding) and WF-004 (Contract Renewal) are workflows for
 * different objects entirely, selected by category rather than by channel, and
 * no request has ever used either.
 */
export function channelStageMapFromTemplates(templates: TemplateLike[]): ChannelStageMap {
  const map: Record<string, readonly RequestStatus[]> = {};
  for (const template of templates) {
    for (const channel of template.channels ?? []) {
      if (!channel) continue;
      // First claim wins, so a second template claiming the same channel
      // cannot silently replace the first. `unclaimedChannels` and the
      // designer's diagnostics report the collision instead.
      if (map[channel]) continue;
      map[channel] = stagesFromTemplate(template);
    }
  }
  return map;
}

/** Channels claimed by more than one template — a collision, not a fallback. */
export function contestedChannels(templates: TemplateLike[]): string[] {
  const counts = new Map<string, number>();
  for (const template of templates) {
    for (const channel of template.channels ?? []) {
      if (!channel) continue;
      counts.set(channel, (counts.get(channel) ?? 0) + 1);
    }
  }
  return [...counts.entries()].filter(([, n]) => n > 1).map(([channel]) => channel);
}

/**
 * Channels no template claims.
 *
 * Reported rather than silently filled. A channel with no lifecycle is a
 * routing destination the platform cannot actually run, and the old code map
 * hid that by always having an answer.
 */
export function unclaimedChannels(
  map: ChannelStageMap,
  channels: readonly BuyingChannel[],
): BuyingChannel[] {
  return channels.filter((channel) => !map[channel]?.length);
}

/**
 * Every stage any channel traverses, in lifecycle order.
 *
 * The longest claimed path first, then anything the others add. Replaces the
 * two verbatim `LIFECYCLE_STAGES` copies in the request-detail components and
 * the Form Builder's restated list.
 */
export function lifecycleStagesFrom(map: ChannelStageMap): RequestStatus[] {
  const paths = Object.values(map);
  if (paths.length === 0) return [];
  const longest = paths.reduce((a, b) => (b.length > a.length ? b : a));
  const seen = new Set<string>(longest);
  const extras = paths.flat().filter((stage) => !seen.has(stage));
  return [...longest, ...new Set(extras)];
}
