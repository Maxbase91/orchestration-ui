// Supplier master-data completeness (RTE-04).
//
// Checks whether the selected supplier's master data is complete enough to
// proceed: fully onboarded, with current certifications. An incomplete record
// is routed to a remediation next-step on the determination (the front door
// routes, it does not write). Standardised and organisation-agnostic.

export interface SupplierDataInput {
  onboardingStatus?: 'completed' | 'in-progress' | 'not-started';
  certifications?: { status: 'valid' | 'expiring' | 'expired' }[];
}

export interface SupplierDataResult {
  /** True when no master-data remediation is needed. */
  complete: boolean;
  issues: string[];
  message: string;
}

/**
 * Evaluate a supplier's master-data completeness. No supplier selected is not an
 * issue (a sourcing event may pick one later); a selected supplier that isn't
 * fully onboarded, or has expired certifications, needs remediation first.
 */
export function evaluateSupplierData(supplier: SupplierDataInput | undefined): SupplierDataResult {
  if (!supplier) {
    return { complete: true, issues: [], message: 'No supplier selected yet' };
  }
  const issues: string[] = [];
  if (supplier.onboardingStatus === 'not-started') issues.push('Supplier not onboarded');
  else if (supplier.onboardingStatus === 'in-progress') issues.push('Supplier onboarding in progress');

  const expired = (supplier.certifications ?? []).filter((c) => c.status === 'expired').length;
  if (expired > 0) issues.push(`${expired} expired certification${expired > 1 ? 's' : ''}`);

  return {
    complete: issues.length === 0,
    issues,
    message: issues.length ? issues.join('; ') : 'Supplier master data complete',
  };
}
