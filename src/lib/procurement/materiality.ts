// Materiality & criticality determination.
//
// Standardised, organisation-agnostic. Derives whether a demand is *material*
// (and at what criticality) from the qualifying signals already captured —
// data sensitivity (from the service description), inherent supplier risk, and
// value — plus an explicit "critical service" flag seam for when the service
// description's qualification says so directly.
//
// Material demand raises a regulatory/materiality register flag and warrants a
// heightened approval path. Highest-attribute-wins, matching the policy default.
// Nothing here is specific to any regime or industry; thresholds are constants
// so they can later move into the configurable rule store.

import type { RiskRating } from '@/data/types';
import { DEFAULT_POLICY_CONFIG } from './policy-config';

export type DataSensitivity = 'none' | 'low' | 'medium' | 'high' | 'critical';
export type Criticality = 'standard' | 'important' | 'critical';

/** Value at/above which a demand is treated as material on size alone. */
export const MATERIALITY_VALUE_THRESHOLD = DEFAULT_POLICY_CONFIG.materialityValueThreshold;

export interface MaterialityInput {
  dataSensitivity?: DataSensitivity;
  riskRating?: RiskRating;
  value?: number;
  /** Explicit "qualifies as a critical service" signal from the description. */
  criticalService?: boolean;
}

export interface MaterialityResult {
  criticality: Criticality;
  /** True when criticality is important or critical. */
  material: boolean;
  /** Regulatory / materiality register flag — equals `material`. */
  flag: boolean;
  reasons: string[];
}

const LEVEL: Record<Criticality, number> = { standard: 0, important: 1, critical: 2 };
const CRITICALITY: Criticality[] = ['standard', 'important', 'critical'];

/**
 * Determine materiality and criticality, highest-attribute-wins. A `critical`
 * data class, critical supplier risk, or an explicit critical-service flag make
 * the demand critical; high sensitivity/risk or value over the threshold make it
 * important. Anything else is standard (not material).
 */
export function determineMateriality(input: MaterialityInput): MaterialityResult {
  let level = 0;
  const reasons: string[] = [];
  const raise = (to: number, reason: string) => {
    if (to > 0) reasons.push(reason);
    level = Math.max(level, to);
  };

  if (input.criticalService) raise(2, 'Qualifies as a critical service');

  if (input.dataSensitivity === 'critical') raise(2, 'Critical data sensitivity');
  else if (input.dataSensitivity === 'high') raise(1, 'High data sensitivity');

  if (input.riskRating === 'critical') raise(2, 'Critical inherent supplier risk');
  else if (input.riskRating === 'high') raise(1, 'High inherent supplier risk');

  if ((input.value ?? 0) >= MATERIALITY_VALUE_THRESHOLD) {
    raise(1, 'Value at or above the materiality threshold');
  }

  const criticality = CRITICALITY[level];
  const material = level >= LEVEL.important;
  return {
    criticality,
    material,
    flag: material,
    reasons: reasons.length > 0 ? reasons : ['No materiality triggers'],
  };
}
