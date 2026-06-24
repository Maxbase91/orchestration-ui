// Supplier screening evaluation (SUP-03).
//
// Surfaces the supplier's screening status (sanctions / watchlist / adverse
// media — modelled as a single status today) on the determination, and tells
// the front door whether it blocks proceeding. Standardised and
// organisation-agnostic.

export type ScreeningStatus = 'clear' | 'flagged' | 'pending' | 'unknown';

export interface ScreeningResult {
  status: ScreeningStatus;
  /** Safe to proceed with no screening action. */
  cleared: boolean;
  /** Must be resolved before the demand can proceed (refer back). */
  blocking: boolean;
  message: string;
}

/**
 * Evaluate a supplier's screening status. A `flagged` supplier blocks (refer
 * back); `pending` is a non-blocking caution to clear before award; an unknown
 * / unset status means the supplier hasn't been screened yet.
 */
export function evaluateScreening(status: string | undefined): ScreeningResult {
  switch (status) {
    case 'clear':
      return { status: 'clear', cleared: true, blocking: false, message: 'Screening clear' };
    case 'flagged':
      return { status: 'flagged', cleared: false, blocking: true, message: 'Flagged in screening — resolve before proceeding' };
    case 'pending':
      return { status: 'pending', cleared: false, blocking: false, message: 'Screening pending — complete before award' };
    default:
      return { status: 'unknown', cleared: false, blocking: false, message: 'Not yet screened' };
  }
}
