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
  'business-led':       ['intake', 'validation', 'approval', 'po', 'receipt', 'invoice', 'payment'],
  'framework-call-off': ['intake', 'validation', 'approval', 'po', 'receipt', 'invoice', 'payment'],
  'procurement-led':    ['intake', 'validation', 'approval', 'sourcing', 'contracting', 'po', 'receipt', 'invoice', 'payment'],
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
