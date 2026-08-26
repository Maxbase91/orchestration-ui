// Who the supplier portal is acting as.
//
// There is no supplier session: the portal renders for one fixed supplier. This
// constant stands in for portal authentication, and it was previously
// copy-pasted into portal-dashboard, portal-invoices and portal-profile — so
// replacing it with a real identity meant finding every copy.
//
// When portal auth arrives, this is the single place that changes: swap the
// constant for a lookup against the session and every portal page follows.

/** The supplier the portal acts as until portal authentication exists. */
export const PORTAL_SUPPLIER_ID = 'SUP-001';

export function usePortalSupplierId(): string {
  return PORTAL_SUPPLIER_ID;
}
