// Approval-to-source gate (DET-05).
//
// Before a demand can move into sourcing, the front door determines which
// pre-sourcing approval gates are required, based on value, materiality and
// inherent risk. This is the standardised, white-label form of the gate: it
// names generic roles (demand validation, cost-centre, intent-to-source,
// category approval) rather than any organisation-specific committee.
//
// Two tiers, mirroring the routing defaults (POL-01):
//   - light: low/medium risk, below the full-approval value threshold and not
//            material → demand validation + cost-centre sign-off.
//   - full:  at/above the threshold, OR material, OR high/critical inherent
//            risk → demand validation + intent-to-source + category approval.
//
// Early exits (catalogue order, direct transact against a contract) do not
// enter sourcing, so they require no approval-to-source gate.

import type { RiskTier } from './risk-segmentation';
import { riskTierRank } from './risk-segmentation';
import { DEFAULT_POLICY_CONFIG, getActivePolicyConfig, type PolicyConfig } from './policy-config';

export type ApprovalTier = 'none' | 'light' | 'full';

export type ApprovalGateId =
  | 'demand-validation'
  | 'cost-centre'
  | 'intent-to-source'
  | 'category-approval';

export interface ApprovalGate {
  id: ApprovalGateId;
  label: string;
  reason: string;
}

export interface ApprovalToSourceInput {
  estimatedValue: number;
  /** Materiality flag from `determineMateriality`. */
  material: boolean;
  /** Inherent-risk tier from `determineInherentRisk`. */
  inherentTier: RiskTier;
  /** A catalogue order or direct transact bypasses sourcing — no gate needed. */
  earlyExit?: boolean;
}

export interface ApprovalToSourceResult {
  tier: ApprovalTier;
  gates: ApprovalGate[];
  rationale: string;
}

/**
 * Value at or above which a demand always needs the full approval-to-source
 * gate. Sourced from the central policy config (CFG).
 */
export const FULL_APPROVAL_VALUE_THRESHOLD = DEFAULT_POLICY_CONFIG.approvalFullThreshold;

const LIGHT_GATES: ApprovalGate[] = [
  {
    id: 'demand-validation',
    label: 'Demand validation',
    reason: 'Confirm the demand is permissible, correctly classified and in scope before sourcing.',
  },
  {
    id: 'cost-centre',
    label: 'Cost-centre approval',
    reason: 'Cost-centre owner approves the spend commitment.',
  },
];

/**
 * Determine the approval-to-source gate for a demand heading into sourcing.
 * `full` is triggered by value at/above the threshold, materiality, or
 * high/critical inherent risk — whichever applies first.
 */
export function determineApprovalToSource(
  input: ApprovalToSourceInput,
  config: PolicyConfig = getActivePolicyConfig(),
): ApprovalToSourceResult {
  if (input.earlyExit) {
    return {
      tier: 'none',
      gates: [],
      rationale: 'Catalogue order or direct transact — does not enter sourcing, so no approval-to-source gate applies.',
    };
  }

  const triggers: string[] = [];
  if (input.estimatedValue >= config.approvalFullThreshold) {
    triggers.push(`value at or above the ${config.approvalFullThreshold.toLocaleString()} threshold`);
  }
  if (input.material) triggers.push('material demand');
  if (riskTierRank(input.inherentTier) >= riskTierRank('high')) {
    triggers.push(`${input.inherentTier} inherent risk`);
  }

  if (triggers.length > 0) {
    return {
      tier: 'full',
      gates: [
        LIGHT_GATES[0],
        {
          id: 'intent-to-source',
          label: 'Intent-to-source approval',
          reason: 'Escalated sign-off to commence sourcing for a high-value, material or high-risk demand.',
        },
        {
          id: 'category-approval',
          label: 'Category approval',
          reason: 'Category lead approves the sourcing approach and supplier strategy.',
        },
      ],
      rationale: `Full approval-to-source required: ${triggers.join(', ')}.`,
    };
  }

  return {
    tier: 'light',
    gates: LIGHT_GATES,
    rationale: 'Light approval-to-source: low/medium risk, below the full-approval value threshold and not material.',
  };
}
