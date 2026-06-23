// Preferred-supplier (PSL) and competitive-sourcing (DTPS) controls.
//
// Standardised, organisation-agnostic procurement rules used by the front-door
// checks. Both are SOFT preferences/controls surfaced to the user — never hard
// gates — matching the policy that a preferred route or a justification can
// satisfy them. Thresholds are constants here so they can later move into the
// configurable rule store without changing call sites.

import type { Supplier } from '@/data/types';

/** Order value at/above which competitive sourcing applies, unless exempt. */
export const COMPETITIVE_SOURCING_THRESHOLD = 25000;
/** Minimum competitive quotes required above the threshold when not exempt. */
export const MIN_COMPETITIVE_QUOTES = 3;
/** Performance score at/above which an established supplier qualifies as preferred. */
export const PREFERRED_MIN_PERFORMANCE = 75;

/**
 * Preferred-supplier (PSL) determination — a soft preference, not a hard gate.
 *
 * An explicit `preferred` flag on the supplier record (PSL reference data) wins
 * when present. Otherwise it falls back to an established-relationship heuristic:
 * a contracted, non-critical-risk, well-performing supplier. The caller may pass
 * `hasActiveContract` when it already knows the relationship (e.g. from a
 * contract lookup); otherwise the supplier's own `activeContracts` is used.
 */
export function isPreferredSupplier(
  supplier: Supplier | undefined,
  opts: { hasActiveContract?: boolean } = {},
): boolean {
  if (!supplier) return false;
  if (typeof supplier.preferred === 'boolean') return supplier.preferred;
  const established = opts.hasActiveContract ?? supplier.activeContracts > 0;
  return (
    established &&
    supplier.riskRating !== 'critical' &&
    (supplier.performanceScore ?? 0) >= PREFERRED_MIN_PERFORMANCE
  );
}

export interface PolicyCheck {
  label: string;
  passed: boolean;
  detail: string;
}

/**
 * Competitive-sourcing (DTPS) check. Above the threshold, competitive quotes are
 * required unless the demand is exempt: routed to a preferred (PSL) supplier, in
 * an exempt category, or covered by an explicit single-source justification.
 */
export function competitiveSourcingCheck(params: {
  value: number;
  category: string;
  isPreferred: boolean;
  exemptCategories?: string[];
  singleSourceJustified?: boolean;
}): PolicyCheck {
  const {
    value,
    category,
    isPreferred,
    exemptCategories = ['contingent-labour'],
    singleSourceJustified = false,
  } = params;

  const belowThreshold = value < COMPETITIVE_SOURCING_THRESHOLD;
  const categoryExempt = exemptCategories.includes(category);
  const exempt = belowThreshold || categoryExempt || isPreferred || singleSourceJustified;

  let detail: string;
  if (belowThreshold) detail = 'Below the competitive-sourcing threshold';
  else if (categoryExempt) detail = `Exempt category (${category})`;
  else if (isPreferred) detail = 'Preferred-supplier route — competitive quotes waived';
  else if (singleSourceJustified) detail = 'Single-source justification on file';
  else detail = `Requires a minimum of ${MIN_COMPETITIVE_QUOTES} competitive quotes`;

  return { label: 'Competitive sourcing (DTPS)', passed: exempt, detail };
}

/** Soft policy check surfacing whether the selected supplier is on the PSL. */
export function preferredSupplierCheck(params: {
  supplier: Supplier | undefined;
  isPreferred: boolean;
}): PolicyCheck {
  const { supplier, isPreferred } = params;
  return {
    label: 'Preferred-supplier routing',
    // Soft preference: passes unless a supplier is selected that is not preferred.
    passed: !supplier || isPreferred,
    detail: !supplier
      ? 'No supplier selected yet'
      : isPreferred
        ? `${supplier.name} is a preferred supplier`
        : `${supplier.name} is not on the preferred list — allowed, but flag for review`,
  };
}
