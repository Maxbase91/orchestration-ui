// Preliminary Operational Risk Assessment (RSK-02).
//
// A structured, front-door operational-risk screen across standard operational
// dimensions. Where the inherent-risk cascade (risk-segmentation.ts) gives a
// single highest-attribute-wins tier, this gives a per-dimension breakdown so
// the determination can show *which* operational concerns are elevated and route
// the detailed assessment accordingly. The overall rating is worst-dimension-wins.
//
// Standardised / white-label: the dimensions are generic operational-risk
// categories (business continuity, data handling, concentration, regulatory
// exposure, access), not any organisation-specific control set.

import type { DataSensitivity } from './materiality';
import { DEFAULT_POLICY_CONFIG } from './policy-config';

export type OpRiskRating = 'low' | 'medium' | 'high';

export type OpRiskDimensionKey =
  | 'business-continuity'
  | 'data-handling'
  | 'concentration'
  | 'regulatory'
  | 'access';

export interface OpRiskDimension {
  key: OpRiskDimensionKey;
  label: string;
  rating: OpRiskRating;
  reason: string;
}

export interface OperationalRiskInput {
  dataSensitivity: DataSensitivity;
  /** Materiality flag from `determineMateriality`. */
  material: boolean;
  /** Supports a critical business service (mini-IRQ / SD qualification). */
  criticalService: boolean;
  /** Grants privileged or system access (mini-IRQ). */
  privilegedAccess: boolean;
  estimatedValue: number;
  /** An existing relationship with this supplier — a concentration signal. */
  incumbentRelationship: boolean;
}

export interface OperationalRiskResult {
  overall: OpRiskRating;
  dimensions: OpRiskDimension[];
}

/** Spend at or above which availability/continuity dependence is non-trivial. */
export const CONTINUITY_VALUE_THRESHOLD = DEFAULT_POLICY_CONFIG.continuityThreshold;

const RANK: Record<OpRiskRating, number> = { low: 0, medium: 1, high: 2 };
const SENSITIVITY_RANK: Record<DataSensitivity, number> = {
  none: 0, low: 0, medium: 1, high: 2, critical: 2,
};

/**
 * Run the preliminary operational risk assessment. Each dimension is rated
 * independently; the overall rating is the worst dimension.
 */
export function assessOperationalRisk(input: OperationalRiskInput): OperationalRiskResult {
  const dimensions: OpRiskDimension[] = [];

  // Business continuity — dependence on the service being available.
  dimensions.push({
    key: 'business-continuity',
    label: 'Business continuity',
    rating: input.criticalService ? 'high' : input.estimatedValue >= CONTINUITY_VALUE_THRESHOLD ? 'medium' : 'low',
    reason: input.criticalService
      ? 'Supports a critical business service'
      : input.estimatedValue >= CONTINUITY_VALUE_THRESHOLD
        ? 'Material spend implies an operational dependency'
        : 'No critical-service or material-spend dependency',
  });

  // Data handling — sensitivity of the data the supplier touches.
  const dataRating: OpRiskRating = SENSITIVITY_RANK[input.dataSensitivity] >= 2 ? 'high' : SENSITIVITY_RANK[input.dataSensitivity] === 1 ? 'medium' : 'low';
  dimensions.push({
    key: 'data-handling',
    label: 'Data handling',
    rating: dataRating,
    reason: dataRating === 'low' ? 'No sensitive data handling indicated' : `${input.dataSensitivity} data sensitivity`,
  });

  // Concentration — dependence on a single / incumbent supplier.
  dimensions.push({
    key: 'concentration',
    label: 'Concentration',
    rating: input.incumbentRelationship && input.material ? 'high' : input.incumbentRelationship ? 'medium' : 'low',
    reason: input.incumbentRelationship
      ? input.material
        ? 'Material demand on an incumbent supplier — concentration risk'
        : 'Existing incumbent relationship'
      : 'No incumbent concentration',
  });

  // Regulatory / materiality exposure.
  dimensions.push({
    key: 'regulatory',
    label: 'Regulatory exposure',
    rating: input.material ? 'high' : 'low',
    reason: input.material ? 'Material / regulatory flag raised' : 'Not material',
  });

  // Access / system integration.
  dimensions.push({
    key: 'access',
    label: 'Access & integration',
    rating: input.privilegedAccess ? 'high' : 'low',
    reason: input.privilegedAccess ? 'Privileged or system access granted' : 'No privileged access',
  });

  const overall = dimensions.reduce<OpRiskRating>(
    (worst, d) => (RANK[d.rating] > RANK[worst] ? d.rating : worst),
    'low',
  );

  return { overall, dimensions };
}
