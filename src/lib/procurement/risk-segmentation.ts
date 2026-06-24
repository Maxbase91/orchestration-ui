// Risk segmentation & outcome.
//
// Determines a demand's inherent risk tier (the cascade) from the qualifying
// signals, and the non-binary risk outcome — reuse / amend / change / new —
// against the third-party risk register. Standardised and organisation-agnostic;
// highest-attribute-wins, matching the policy default. Thresholds are constants
// so they can later move into the configurable rule store.

import type { RiskRating } from '@/data/types';
import type { DataSensitivity } from './materiality';
import { DEFAULT_POLICY_CONFIG } from './policy-config';

/** Inherent risk tier — same scale as supplier risk ratings. */
export type RiskTier = RiskRating;

/** Risk outcome: what to do with the assessment. */
export type RiskOutcome = 'reuse' | 'amend' | 'change' | 'new';

const RANK: Record<RiskRating, number> = { low: 0, medium: 1, high: 2, critical: 3 };
const TIERS: RiskTier[] = ['low', 'medium', 'high', 'critical'];

/** Ordinal rank of a risk tier (low=0 … critical=3). */
export function riskTierRank(tier: RiskTier): number {
  return RANK[tier];
}

/** The highest tier in a list, or undefined when empty. */
export function highestRiskTier(tiers: RiskTier[]): RiskTier | undefined {
  return tiers.reduce<RiskTier | undefined>(
    (max, t) => (max === undefined || RANK[t] > RANK[max] ? t : max),
    undefined,
  );
}

/** Value contributing to a high inherent tier. */
export const RISK_HIGH_VALUE = DEFAULT_POLICY_CONFIG.riskHighValue;
/** Value contributing to a medium inherent tier. */
export const RISK_MEDIUM_VALUE = DEFAULT_POLICY_CONFIG.riskMediumValue;

export interface InherentRiskInput {
  dataSensitivity?: DataSensitivity;
  supplierRiskRating?: RiskRating;
  value?: number;
  /** Engagement grants privileged/system access. */
  privilegedAccess?: boolean;
  /** Supports a critical service (from the description's qualification). */
  criticalService?: boolean;
}

export interface InherentRiskResult {
  tier: RiskTier;
  drivers: string[];
}

/**
 * Inherent-risk cascade, highest-attribute-wins. Highly-confidential data,
 * privileged access, critical supplier risk, or a critical service drive the
 * tier to critical; high sensitivity/risk or value over the high threshold drive
 * it to high; and so on.
 */
export function determineInherentRisk(input: InherentRiskInput): InherentRiskResult {
  let level = 0;
  const drivers: string[] = [];
  const raise = (to: number, reason: string) => {
    if (to > 0) drivers.push(reason);
    level = Math.max(level, to);
  };

  if (input.criticalService) raise(3, 'Supports a critical service');
  if (input.privilegedAccess) raise(3, 'Privileged or system access');
  if (input.dataSensitivity === 'critical') raise(3, 'Highly confidential data');
  else if (input.dataSensitivity === 'high') raise(2, 'High data sensitivity');
  else if (input.dataSensitivity === 'medium') raise(1, 'Internal data');

  if (input.supplierRiskRating === 'critical') raise(3, 'Critical supplier risk');
  else if (input.supplierRiskRating === 'high') raise(2, 'High supplier risk');
  else if (input.supplierRiskRating === 'medium') raise(1, 'Medium supplier risk');

  const value = input.value ?? 0;
  if (value >= RISK_HIGH_VALUE) raise(2, 'High contract value');
  else if (value >= RISK_MEDIUM_VALUE) raise(1, 'Moderate contract value');

  return { tier: TIERS[level], drivers: drivers.length ? drivers : ['No elevated risk drivers'] };
}

export interface RiskOutcomeInput {
  inherentTier: RiskTier;
  /** Whether the risk register already holds a reusable assessment. */
  reusableAssessmentExists: boolean;
  /** Highest tier covered by the reusable assessment(s), if any. */
  highestAssessedTier?: RiskTier;
}

export interface RiskOutcomeResult {
  outcome: RiskOutcome;
  reason: string;
}

/**
 * Decide the non-binary risk outcome. No reusable assessment → new. Otherwise:
 * inherent at or below what's assessed → reuse; one tier above → amend (a delta
 * reassessment); more than one tier above → change (material reassessment).
 */
export function determineRiskOutcome(input: RiskOutcomeInput): RiskOutcomeResult {
  if (!input.reusableAssessmentExists) {
    return { outcome: 'new', reason: 'No reusable assessment covers this engagement' };
  }
  const assessed = input.highestAssessedTier ?? 'low';
  const gap = RANK[input.inherentTier] - RANK[assessed];
  if (gap <= 0) {
    return { outcome: 'reuse', reason: `Inherent risk (${input.inherentTier}) within the assessed band (${assessed})` };
  }
  if (gap === 1) {
    return { outcome: 'amend', reason: `Inherent risk one tier above assessed — delta reassessment` };
  }
  return { outcome: 'change', reason: `Inherent risk materially above assessed — full reassessment` };
}
