// Criteria-triggered residual questions (INT-10, stage 5).
//
// The front door derives as much as it can from the service description, then
// asks only the residual questions that the derived signals leave open AND that
// would change the determination. A low-value, low-sensitivity catalogue-style
// demand should be asked nothing; a high-value or sensitive engagement is asked
// the deltas that the SD cannot reveal.
//
// Each question maps to a mini-IRQ field, so the answers feed the same
// inherent-risk and materiality cascades as before — only the *visibility* of
// each question is now driven by criteria instead of always being shown.

import type { DataSensitivity } from './materiality';
import type { RiskTier } from './risk-segmentation';
import { DEFAULT_POLICY_CONFIG, getActivePolicyConfig, type PolicyConfig } from './policy-config';

export type ResidualQuestionId = 'privileged-access' | 'critical-service';

/** The mini-IRQ delta fields a residual answer can map to. */
export type MiniIrqField = 'privilegedAccess' | 'criticalService';

export interface ResidualQuestionContext {
  category: string;
  dataSensitivity: DataSensitivity;
  estimatedValue: number;
  supplierRiskRating?: RiskTier;
}

export interface ResidualQuestion {
  id: ResidualQuestionId;
  field: MiniIrqField;
  question: string;
  /** The criterion that triggered the question — shown so the user sees why. */
  reason: string;
}

/** Spend at or above which a critical-service dependency is worth confirming. */
export const CRITICAL_SERVICE_VALUE_THRESHOLD = DEFAULT_POLICY_CONFIG.criticalServiceThreshold;

// Categories where privileged or system access is plausible enough to confirm.
const ACCESS_CATEGORIES = new Set(['software', 'services', 'consulting', 'contingent-labour']);

const SENSITIVITY_RANK: Record<DataSensitivity, number> = {
  none: 0, low: 1, medium: 2, high: 3, critical: 4,
};

/**
 * Decide which residual questions to ask. Returns an ordered list; an empty
 * list means the service description already determines everything we need.
 */
export function determineResidualQuestions(
  ctx: ResidualQuestionContext,
  config: PolicyConfig = getActivePolicyConfig(),
): ResidualQuestion[] {
  const out: ResidualQuestion[] = [];
  const sensitivity = SENSITIVITY_RANK[ctx.dataSensitivity] ?? 0;

  // Privileged / system access — relevant when the engagement type plausibly
  // touches systems, or when it already handles medium+ sensitivity data.
  if (ACCESS_CATEGORIES.has(ctx.category) || sensitivity >= SENSITIVITY_RANK.medium) {
    out.push({
      id: 'privileged-access',
      field: 'privilegedAccess',
      question: 'Does this engagement grant privileged or system access?',
      reason: ACCESS_CATEGORIES.has(ctx.category)
        ? `${ctx.category} engagements often involve system access`
        : `${ctx.dataSensitivity} data sensitivity`,
    });
  }

  // Critical business service — relevant when the spend is material in size, the
  // supplier is already elevated-risk, or the data is highly sensitive.
  const supplierElevated = ctx.supplierRiskRating === 'high' || ctx.supplierRiskRating === 'critical';
  if (
    ctx.estimatedValue >= config.criticalServiceThreshold ||
    supplierElevated ||
    sensitivity >= SENSITIVITY_RANK.high
  ) {
    const reason = ctx.estimatedValue >= config.criticalServiceThreshold
      ? 'material spend'
      : supplierElevated
        ? `${ctx.supplierRiskRating} supplier risk`
        : `${ctx.dataSensitivity} data sensitivity`;
    out.push({
      id: 'critical-service',
      field: 'criticalService',
      question: 'Does it support a critical business service?',
      reason,
    });
  }

  return out;
}
