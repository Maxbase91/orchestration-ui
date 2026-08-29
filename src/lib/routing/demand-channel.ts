// The buying channel for a demand — one derivation, two screens.
//
// The channel is the single most consequential thing the front door decides:
// it is the difference between a two-day catalogue order and a multi-week
// procurement-led exercise. It was first shown at step 5, on the determination,
// even though nine of the ten live routing rules are fully determined by the
// end of step 2.
//
// Showing it earlier is only safe if it is the SAME answer. A second derivation
// on the pre-check would be exactly the drift this codebase has paid for
// repeatedly — three narrative composers, two classifiers, a test panel that
// implemented its own evaluator. So both screens call this, and the intake
// routing test asserts they agree across the labelled demand set.

import type { RiskTier } from '@/lib/procurement/risk-segmentation';
import type { BuyingChannel, RoutingRule } from '@/data/types';
import { resolveRouting, type RoutingMatch } from './evaluate-routing-rules';

export interface DemandChannelInput {
  category: string;
  value: number;
  supplierId?: string;
  /** A transactable contract already covers this — known from the pre-check. */
  contractId?: string;
  isUrgent?: boolean;
  /** The inherent-risk tier, when it has been computed. */
  riskRating?: RiskTier;
  /** The materiality / regulatory flag, when it has been determined. */
  material?: boolean;
  region?: string;
  /** Eligibility must be proven by evaluatePCardEligibility before routing. */
  pCardEligible?: boolean;
}

/**
 * Resolve the buying channel for a demand.
 *
 * `priority` is derived from `isUrgent` rather than passed separately: the two
 * are one fact, and RR-010 ("Urgent request fast-track") requires both, so
 * setting one without the other silently disarms the rule.
 */
export function resolveDemandChannel(
  rules: RoutingRule[],
  input: DemandChannelInput,
): RoutingMatch {
  return resolveRouting(rules, {
    category: input.category,
    value: input.value,
    supplierId: input.supplierId,
    contractId: input.contractId,
    priority: input.isUrgent ? 'urgent' : undefined,
    isUrgent: input.isUrgent,
    riskRating: input.riskRating,
    material: input.material,
    region: input.region,
    pCardEligible: input.pCardEligible,
  });
}

/**
 * Would marking this demand urgent change its channel?
 *
 * The one thing the pre-check cannot settle. Urgency is set on step 3, after
 * the channel has been shown, and RR-010 can flip it — so the toggle has to say
 * what it does at the moment it is ticked. Returns null when nothing would
 * change, so the warning appears only where it is true.
 *
 * RR-010 only ever escalates, so the change is monotonic and explainable; this
 * is deliberately derived from the rule set rather than hardcoding that fact,
 * because an admin can write a rule that does something else.
 */
export function urgencyWouldChangeChannel(
  rules: RoutingRule[],
  input: DemandChannelInput,
): { from: BuyingChannel; to: BuyingChannel } | null {
  const calm = resolveDemandChannel(rules, { ...input, isUrgent: false });
  const urgent = resolveDemandChannel(rules, { ...input, isUrgent: true });
  return calm.channel === urgent.channel
    ? null
    : { from: calm.channel, to: urgent.channel };
}
