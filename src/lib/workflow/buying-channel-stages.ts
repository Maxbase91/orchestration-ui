// Relative, not `@/data/types`, so api/_domains/intake-submit.ts can import this
// module — the same reason src/lib/db/mappers.ts uses relative specifiers.
import type { BuyingChannel, RequestStatus } from '../../data/types.js';

/**
 * Canonical map of buying channels → the lifecycle stages the request
 * actually traverses. Stages not in the list render as `skipped` on
 * the lifecycle stepper and in the Workflow tab.
 *
 * Rules:
 *   - catalogue:          intake → approval (when threshold requires it) →
 *                         po → receipt → invoice → payment. Pre-approved
 *                         low-value items skip the approval stage at runtime.
 *   - direct-po:          skip sourcing + contracting
 *   - business-led:       skip sourcing + contracting (low-value path
 *                         with single-level approval)
 *   - framework-call-off: skip sourcing + contracting (contract already
 *                         executed as a framework, just a call-off)
 *   - p-card:             route to the approved P-card process after review;
 *                         this platform does not execute payment
 *   - procurement-led:    full flow (intake → payment)
 *
 * `validation` is on the procurement-led path only. It is the category
 * manager's check that the demand is complete, correctly categorised and
 * routed to the right channel — a question that only has an answer when the
 * demand is going to market. A catalogue order takes its category and supplier
 * from the item; a framework call-off takes them from the contract, which was
 * validated when it was signed. Asking a category manager to re-validate those
 * is a queue with nothing in it to decide, and it is why requests sat in
 * validation for days: every channel entered a stage most of them had no use
 * for.
 */
const STAGES_BY_CHANNEL: Record<BuyingChannel, RequestStatus[]> = {
  catalogue:            ['intake', 'approval', 'po', 'receipt', 'invoice', 'payment'],
  'direct-po':          ['intake', 'approval', 'po', 'receipt', 'invoice', 'payment'],
  'business-led':       ['intake', 'risk', 'onboarding', 'approval', 'po', 'receipt', 'invoice', 'payment'],
  'framework-call-off': ['intake', 'risk', 'onboarding', 'approval', 'po', 'receipt', 'invoice', 'payment'],
  'p-card':             ['intake', 'approval'],
  // `risk` sits after validation and is entered only when the intake triage
  // required one — see the conditional edge in WF-001. It appears in the stage
  // list so the stepper can render it as skipped rather than omitting it.
  'procurement-led':    ['intake', 'validation', 'risk', 'onboarding', 'approval', 'sourcing', 'contracting', 'po', 'receipt', 'invoice', 'payment'],
};

/**
 * Every channel the platform can route a demand to.
 *
 * Derived from the map rather than restated, because a restated copy is what
 * broke: api/_domains/intake-submit.ts validated the submitted channel against
 * its own hand-written set, which omitted `business-led` — a channel the
 * fallback produces for any EUR 25-50k demand outside consulting, and one a
 * seeded routing rule targets by name. The platform chose the route and then
 * rejected it with a 422 the requester could do nothing about.
 */
export const BUYING_CHANNELS = Object.keys(STAGES_BY_CHANNEL) as BuyingChannel[];

const FULL_LIFECYCLE: RequestStatus[] = [
  'intake', 'validation', 'approval', 'sourcing', 'contracting', 'po', 'receipt', 'invoice', 'payment',
];

/** Stages the request will actually visit for its channel. Unknown
 *  channels fall back to the full 9-stage path. */
export function getStagesForChannel(channel: BuyingChannel | string | undefined): RequestStatus[] {
  if (!channel) return FULL_LIFECYCLE;
  return STAGES_BY_CHANNEL[channel as BuyingChannel] ?? FULL_LIFECYCLE;
}

/** True when this stage is NOT traversed for the given channel. */
export function isStageSkippedForChannel(
  channel: BuyingChannel | string | undefined,
  stage: RequestStatus | string,
): boolean {
  const stages = getStagesForChannel(channel);
  return !stages.includes(stage as RequestStatus);
}

/**
 * The stage that follows `stage` for this channel, or null at the end.
 *
 * Used only when a request has no workflow instance to advance — 93 of 101
 * requests predate the engine creating one, so this is the common path, not a
 * rare fallback. The channel's own stage list is the right source: it encodes
 * the approval edge for high-value catalogue orders while still skipping
 * validation, sourcing and contracting.
 */
export function nextStageAfter(
  channel: string | undefined,
  stage: string,
): RequestStatus | null {
  const stages = getStagesForChannel(channel as BuyingChannel);
  const idx = stages.indexOf(stage as RequestStatus);
  if (idx === -1 || idx === stages.length - 1) return null;
  return stages[idx + 1] ?? null;
}

/**
 * The stage a request enters when intake completes.
 *
 * The server used to write a constant `validation` for every channel. That was
 * deliberate once — an earlier version branched to risk/approval/sourcing and
 * left the writes those branches implied unreachable, so a constant was the
 * honest fix. But `validation` is now on the procurement-led path only, and the
 * constant outlived that: a business-led or direct-po request landed in a stage
 * its own channel skips, so the stepper drew it as skipped while the request sat
 * in it.
 *
 * This picks from the channel's own list rather than branching on value or
 * category, so it cannot drift from the stepper the way the constant did.
 *
 * `risk` and `onboarding` are conditional — they appear in the lists so the
 * stepper can draw them as skipped, not because every request enters them. Risk
 * is entered only when intake triage asked for it; onboarding depends on the
 * supplier, which intake often does not have yet, so it is never the landing
 * stage and the engine enters it later if needed.
 */
export function firstActionableStage(
  channel: BuyingChannel | string | undefined,
  signals: { riskAssessmentRequired?: boolean } = {},
): RequestStatus {
  const conditional = new Set<RequestStatus>(['onboarding']);
  if (!signals.riskAssessmentRequired) conditional.add('risk');

  const stage = getStagesForChannel(channel)
    .filter((candidate) => candidate !== 'intake' && !conditional.has(candidate))[0];

  // Every channel list reaches `approval` at the latest, so this is a guard
  // against an unknown channel rather than an expected path.
  return stage ?? 'approval';
}
