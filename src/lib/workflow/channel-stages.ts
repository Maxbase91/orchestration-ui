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
  requesterHeadline?: string | null;
  requesterDescription?: string | null;
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

  // A template with nodes and no edges has no graph to traverse, and returning
  // nothing would leave the request detail with a blank stepper — strictly
  // worse than a best effort. Array order is that best effort: it is only
  // *wrong* when edges exist and disagree with it (WF-001 lists Risk Assessment
  // third while the graph reaches it after Validation), and here there are none
  // to disagree.
  if ((template.edges ?? []).length === 0) {
    const seen = new Set<string>();
    return template.nodes
      .filter((n) => n.type === 'stage' && typeof n.label === 'string')
      .map((n) => nodeToStatus(n.label as string) as RequestStatus)
      .filter((status) => !seen.has(status) && seen.add(status));
  }

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
 * A template with no `channels` contributes nothing — it would run no request.
 * The two that claimed none (supplier onboarding, contract renewal) were
 * retired on 2026-09-25.
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

/**
 * The template a request on this channel runs on.
 *
 * Same "first claim wins" rule as the stage map, so the lifecycle a request is
 * drawn against and the template its `workflow_template_id` names can never be
 * two different templates.
 *
 * Returns null when nothing claims the channel. The intake writer defaulted to
 * the literal `'WF-001'`, so a catalogue or business-led request that
 * reached it without an explicit template was recorded as running the
 * procurement-led workflow — a template whose stages it does not traverse. 114
 * of the 136 live requests carry no template id at all, which is the same gap
 * from the other side.
 */
export function templateForChannel(
  templates: TemplateLike[],
  channel: string | undefined,
): string | null {
  if (!channel) return null;
  return templates.find((t) => (t.channels ?? []).includes(channel))?.id ?? null;
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

// ── The lookups, now taking the derived map ──────────────────────────────────
// These carry the same semantics as the code map they replace; what changed is
// where the stage list comes from. Each takes the map explicitly rather than
// reaching for a module singleton: the map is async data, and a default would
// let a caller silently get an empty one.

/**
 * Every channel the platform can route a demand to.
 *
 * Code-owned, and deliberately NOT derived from the templates. The 422 gate in
 * `api/_domains/intake-submit.ts` validates the submitted channel against this,
 * and it once restated its own list which omitted `business-led` — a channel
 * the fallback produces and a seeded rule targets, so the platform chose the
 * route and then rejected it with an error the requester could do nothing
 * about. Deriving it from templates would bring that back in a new form: a
 * channel whose template an admin deleted would become unsubmittable rather
 * than merely unconfigured. `unclaimedChannels` reports that instead.
 */
// Only the channels a demand can actually reach (2026-09-25): Door 1 routes to
// business-led or procurement-led, a real catalogue item makes a catalogue
// order, a transactable contract a call-off. Direct PO and P-card were listed
// here with templates and thresholds behind them, and no honest path to either.
export const BUYING_CHANNELS: readonly BuyingChannel[] = [
  'catalogue', 'business-led', 'framework-call-off', 'procurement-led',
];

/**
 * Stages the request will actually visit for its channel.
 *
 * An unknown or unclaimed channel gets the union rather than a guess: it is the
 * widest honest answer, and it means the stepper draws every stage rather than
 * hiding one. The code map returned a nine-stage `FULL_LIFECYCLE` here that
 * omitted risk and onboarding — so an unknown channel silently lost two stages.
 */
export function getStagesForChannel(
  map: ChannelStageMap,
  channel: string | undefined,
): readonly RequestStatus[] {
  if (channel && map[channel]?.length) return map[channel];
  return lifecycleStagesFrom(map);
}

/** True when this stage is NOT traversed for the given channel. */
export function isStageSkippedForChannel(
  map: ChannelStageMap,
  channel: string | undefined,
  stage: string,
): boolean {
  return !getStagesForChannel(map, channel).includes(stage as RequestStatus);
}

/**
 * The stage that follows `stage` for this channel, or null at the end.
 *
 * Used when a request has no workflow instance to advance, which is the common
 * path rather than a rare fallback — most requests predate the engine creating
 * one.
 */
export function nextStageAfter(
  map: ChannelStageMap,
  channel: string | undefined,
  stage: string,
): RequestStatus | null {
  const stages = getStagesForChannel(map, channel);
  const idx = stages.indexOf(stage as RequestStatus);
  if (idx === -1 || idx === stages.length - 1) return null;
  return stages[idx + 1] ?? null;
}

/**
 * The stage a request enters when intake completes.
 *
 * The server used to write a constant `validation` for every channel, so a
 * business-led request landed in a stage its own channel skips —
 * the stepper drew it as skipped while the request sat in it.
 *
 * `risk` and `onboarding` are conditional: they are in the lists so the stepper
 * can draw them as skipped, not because every request enters them. Risk is
 * entered only when intake triage asked for it; onboarding depends on a
 * supplier intake often does not have yet, so it is never the landing stage and
 * the engine enters it later if needed.
 */
export function firstActionableStage(
  map: ChannelStageMap,
  channel: string | undefined,
  signals: { riskAssessmentRequired?: boolean } = {},
): RequestStatus {
  const conditional = new Set<RequestStatus>(['onboarding']);
  if (!signals.riskAssessmentRequired) conditional.add('risk');

  const stage = getStagesForChannel(map, channel)
    .filter((candidate) => candidate !== 'intake' && !conditional.has(candidate))[0];

  // Every channel reaches `approval` at the latest, so this guards an unknown
  // channel rather than an expected path.
  return stage ?? 'approval';
}

/**
 * What a requester is told about a channel: the headline and sentence set on
 * the template that claims it (Workflow Designer → requester wording).
 *
 * These were a hard-coded map in evaluate-routing-rules.ts, so the wording
 * could not follow a template an admin reshaped. With no wording set, the
 * channel's own label stands in — never a sentence nobody configured.
 */
export function channelCopy(
  templates: TemplateLike[],
  channel: string | undefined,
  fallbackLabel: string,
): { headline: string; detail: string } {
  const id = templateForChannel(templates, channel);
  const template = templates.find((t) => t.id === id);
  return {
    headline: template?.requesterHeadline?.trim() || fallbackLabel,
    detail: template?.requesterDescription?.trim() || '',
  };
}
