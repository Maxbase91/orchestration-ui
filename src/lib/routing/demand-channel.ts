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
import type { RiskRating } from '@/data/types';
import type { BuyingChannel, RoutingRule } from '@/data/types';
import type { PolicyConfig } from '@/lib/procurement/policy-config';
import { resolveRouting, type RoutingMatch } from './evaluate-routing-rules';

/**
 * Every routing input, and every one of them required.
 *
 * They are required rather than optional on purpose. The header above says both
 * screens call this so they cannot drift — and they drifted anyway, because
 * optional fields let a caller omit one silently: the buy-route step left out
 * `isUrgent`, so RR-010 "Urgent request fast-track" could fire on the
 * determination and never on the screen shown two steps earlier. Same demand, two answers, no error.
 *
 * `undefined` is still a legitimate value for most of these — it means "not
 * known at this point in the wizard". Requiring the key just makes not knowing
 * a decision the caller writes down rather than an omission nobody sees.
 */
export interface DemandChannelInput {
  category: string;
  value: number;
  supplierId: string | undefined;
  /** A transactable contract already covers this — known from the pre-check. */
  contractId: string | undefined;
  isUrgent: boolean | undefined;
  /** The inherent-risk tier, when it has been computed. */
  riskRating: RiskTier | undefined;
  /** The materiality / regulatory flag, when it has been determined. */
  material: boolean | undefined;
  /** The chosen supplier's own risk rating, when a supplier is known. */
  supplierRiskRating: RiskRating | undefined;
  /**
   * The demand's commodity classification. `SUPPORTED_FIELDS` has always
   * evaluated it and this type had no member for it, so RR-007 and RR-009 —
   * both active, both keyed on `commodityCode starts_with` — could never match
   * anything, while `diagnoseRule` reported them healthy because the field is
   * in the supported vocabulary.
   */
  commodityCode: string | undefined;
}

/** Resolve the buying channel for a demand. */
export function resolveDemandChannel(
  rules: RoutingRule[],
  input: DemandChannelInput,
  config: PolicyConfig,
): RoutingMatch {
  return resolveRouting(rules, {
    category: input.category,
    value: input.value,
    supplierId: input.supplierId,
    contractId: input.contractId,
    isUrgent: input.isUrgent,
    riskRating: input.riskRating,
    supplierRiskRating: input.supplierRiskRating,
    material: input.material,
    commodityCode: input.commodityCode,
  }, config);
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
  config: PolicyConfig,
): { from: BuyingChannel; to: BuyingChannel } | null {
  const calm = resolveDemandChannel(rules, { ...input, isUrgent: false }, config);
  const urgent = resolveDemandChannel(rules, { ...input, isUrgent: true }, config);
  return calm.channel === urgent.channel
    ? null
    : { from: calm.channel, to: urgent.channel };
}
