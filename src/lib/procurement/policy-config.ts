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
  /** Value above which a demand exceeds normal delegated budget authority. */
  delegatedAuthorityThreshold: number;
  /**
   * Intake funnel — minimum score for a catalogue item to be offered.
   * Was a literal 0.5 in the pre-check component, which one weak word cleared.
   */
  catalogueMatchThreshold: number;
  /**
   * Intake funnel — how many of the demand's *naming* words a catalogue match
   * must hit. Words that only qualify a thing ("business", "premium", "office")
   * do not count, which is the guard against a match carried by an adjective
   * while the thing actually being bought goes unmatched. Raise to 2 to demand
   * stronger evidence before offering an item.
   */
  catalogueMinContentMatches: number;
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
  // Preserves the literal the compliance report used before this was
  // configurable; it is not derived from the approval gate, which is separate.
  delegatedAuthorityThreshold: 500_000,
  // 0.5 = one description-level hit. Deliberately the value the funnel always
  // used: the mis-routing was never about the floor being too low, it was about
  // *which* words could clear it. See catalogueMinContentMatches.
  catalogueMatchThreshold: 0.5,
  catalogueMinContentMatches: 1,
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
