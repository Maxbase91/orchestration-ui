import type { BuyingChannel, RequestStatus } from '@/data/types';

/**
 * Canonical map of buying channels → the lifecycle stages the request
 * actually traverses. Stages not in the list render as `skipped` on
 * the lifecycle stepper and in the Workflow tab.
 *
 * Rules:
 *   - catalogue:          intake → po → receipt → invoice → payment
 *                         (pre-approved items skip validation + approval
 *                         + sourcing + contracting)
 *   - direct-po:          skip sourcing + contracting
 *   - business-led:       skip sourcing + contracting (low-value path
 *                         with single-level approval)
 *   - framework-call-off: skip sourcing + contracting (contract already
 *                         executed as a framework, just a call-off)
 *   - procurement-led:    full 9-stage flow (intake → payment)
 */
const STAGES_BY_CHANNEL: Record<BuyingChannel, RequestStatus[]> = {
  catalogue:            ['intake', 'po', 'receipt', 'invoice', 'payment'],
  'direct-po':          ['intake', 'validation', 'approval', 'po', 'receipt', 'invoice', 'payment'],
  'business-led':       ['intake', 'validation', 'risk', 'onboarding', 'approval', 'po', 'receipt', 'invoice', 'payment'],
  'framework-call-off': ['intake', 'validation', 'risk', 'onboarding', 'approval', 'po', 'receipt', 'invoice', 'payment'],
  // `risk` sits after validation and is entered only when the intake triage
  // required one — see the conditional edge in WF-001. It appears in the stage
  // list so the stepper can render it as skipped rather than omitting it.
  'procurement-led':    ['intake', 'validation', 'risk', 'onboarding', 'approval', 'sourcing', 'contracting', 'po', 'receipt', 'invoice', 'payment'],
};

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
 * rare fallback. The channel's own stage list is the right source: it already
 * encodes that catalogue skips validation and approval, so the fallback cannot
 * walk a request through a stage its channel does not have.
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
