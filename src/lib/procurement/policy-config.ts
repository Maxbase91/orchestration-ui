// Central decisioning policy configuration (CFG).
//
// Single source of truth for the thresholds and bands the decisioning modules
// apply (approval gate, materiality, risk bands, competitive sourcing, contract
// coverage). The modules source their constants from `DEFAULT_POLICY_CONFIG`, so
// the values live in one governed place rather than scattered across modules.
//
// `resolvePolicyConfig()` is the seam for an admin-managed / simulation-panel
// override layer: pass a partial config and the decisioning runs against the
// merged values, with no change to the modules.

export interface PolicyConfig {
  /** Value at/above which the full approval-to-source gate applies. */
  approvalFullThreshold: number;
  /** Value at/above which a demand is material on value alone. */
  materialityValueThreshold: number;
  /** Value at/above which the critical-service residual question is asked. */
  criticalServiceThreshold: number;
  /** Value at/above which business-continuity dependence is non-trivial. */
  continuityThreshold: number;
  /** Inherent-risk value band → high. */
  riskHighValue: number;
  /** Inherent-risk value band → medium. */
  riskMediumValue: number;
  /** Order value at/above which competitive sourcing applies, unless exempt. */
  competitiveSourcingThreshold: number;
  /** Minimum competitive quotes required above the threshold. */
  minCompetitiveQuotes: number;
  /** Minimum performance score for a supplier to qualify as preferred. */
  preferredMinPerformance: number;
  /** Second contract check: utilisation headroom % (below → transactable). */
  contractUtilisationHeadroom: number;
  /** Second contract check: days-to-expiry buffer that flags a contract expiring. */
  contractExpiryBufferDays: number;
}

export const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  approvalFullThreshold: 250_000,
  materialityValueThreshold: 1_000_000,
  criticalServiceThreshold: 100_000,
  continuityThreshold: 250_000,
  riskHighValue: 250_000,
  riskMediumValue: 50_000,
  competitiveSourcingThreshold: 25_000,
  minCompetitiveQuotes: 3,
  preferredMinPerformance: 75,
  contractUtilisationHeadroom: 95,
  contractExpiryBufferDays: 60,
};

/**
 * Merge admin / simulation overrides onto the defaults. Undefined fields fall
 * back to the default, so a partial override only changes what it names.
 */
export function resolvePolicyConfig(overrides?: Partial<PolicyConfig>): PolicyConfig {
  return { ...DEFAULT_POLICY_CONFIG, ...(overrides ?? {}) };
}

// Active config — the decisioning functions default to this, so admin-applied
// overrides drive the live front door without threading config through every
// call site. A simulation passes an explicit config instead of mutating this.
let activeConfig: PolicyConfig = { ...DEFAULT_POLICY_CONFIG };

/** The config the live decisioning runs against (defaults unless overridden). */
export function getActivePolicyConfig(): PolicyConfig {
  return activeConfig;
}

/** Apply admin overrides to the active config (e.g. on app boot / on save). */
export function applyPolicyOverrides(overrides?: Partial<PolicyConfig>): PolicyConfig {
  activeConfig = resolvePolicyConfig(overrides);
  return activeConfig;
}

/** Restore the active config to the shipped defaults. */
export function resetActivePolicyConfig(): PolicyConfig {
  activeConfig = { ...DEFAULT_POLICY_CONFIG };
  return activeConfig;
}
