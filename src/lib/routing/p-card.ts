// P-card eligibility — the governed boundary for the low-value card route.
//
// This module only recommends and routes. It never charges a card, creates a
// payment, or writes to an upstream purchasing system. The policy is explicit
// so the simple intake can explain why a route is or is not available.

import type { RiskRating } from '../../data/types';
import { getActivePolicyConfig, type PolicyConfig } from '../procurement/policy-config';

export interface PCardEligibilityInput {
  category?: string;
  value?: number;
  /** A true urgent flag is intentionally incompatible with a card route. */
  isUrgent?: boolean;
  /** Material demands require the governed procurement route. */
  material?: boolean;
  /** High/critical inherent risk requires additional governance. */
  riskRating?: RiskRating;
}

export interface PCardEligibilityResult {
  eligible: boolean;
  reasons: string[];
  /** Actionable reasons the route was withheld, suitable for requester UI. */
  ineligibleReasons: string[];
}

const DISALLOWED_RISK: ReadonlySet<RiskRating> = new Set(['high', 'critical']);

function normalise(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

/**
 * Evaluate the P-card policy using a snapshot of the current decisioning
 * config. Unknown value/category is ineligible: intake must not offer a
 * payment-adjacent route until eligibility can be proven.
 */
export function evaluatePCardEligibility(
  input: PCardEligibilityInput,
  config: PolicyConfig = getActivePolicyConfig(),
): PCardEligibilityResult {
  const ineligibleReasons: string[] = [];
  const reasons: string[] = [];
  const category = normalise(input.category);
  const value = input.value;

  if (!config.pCardEnabled) {
    ineligibleReasons.push('The P-card route is currently disabled by policy.');
  }

  if (!category) {
    ineligibleReasons.push('A category is required before P-card eligibility can be checked.');
  } else if (config.pCardExcludedCategories.map(normalise).includes(category)) {
    ineligibleReasons.push('This category must follow the governed procurement route.');
  } else if (!config.pCardEligibleCategories.map(normalise).includes(category)) {
    ineligibleReasons.push('This category is not eligible for the P-card route.');
  } else {
    reasons.push(`The ${input.category} category is permitted by P-card policy.`);
  }

  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    ineligibleReasons.push('A valid demand value is required before P-card eligibility can be checked.');
  } else if (value > config.pCardMaxValue) {
    ineligibleReasons.push(`The value exceeds the P-card limit of ${config.pCardMaxValue.toLocaleString()}.`);
  } else {
    reasons.push(`The value is within the P-card limit of ${config.pCardMaxValue.toLocaleString()}.`);
  }

  if (input.isUrgent) {
    ineligibleReasons.push('Urgent demands require an expedited governed route.');
  }
  if (input.material) {
    ineligibleReasons.push('Material demands require additional governance.');
  }
  if (input.riskRating && DISALLOWED_RISK.has(input.riskRating)) {
    ineligibleReasons.push(`${input.riskRating[0].toUpperCase()}${input.riskRating.slice(1)}-risk demands require additional governance.`);
  }

  return {
    eligible: ineligibleReasons.length === 0,
    reasons,
    ineligibleReasons,
  };
}
