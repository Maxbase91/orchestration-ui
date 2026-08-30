// Browser persistence seam for governed checkout. The server is authoritative
// for policy, linked records, idempotency, and the transaction boundary.
import type { PurchaseOrder, PurchaseRequisition, RequestLine } from '@/data/types';
import type { GovernedCheckoutDecision, GovernedCheckoutInput } from './governed-checkout';
import type { createRequest } from '@/lib/db/requests';

export interface SubmitGovernedCheckoutInput {
  request: Parameters<typeof createRequest>[0];
  requestId: string;
  requisitionId: string;
  decision: GovernedCheckoutDecision;
  checkout: GovernedCheckoutInput;
  lines: RequestLine[];
  poId?: string;
}

export interface SubmitGovernedCheckoutResult {
  requestId: string;
  request?: Parameters<typeof createRequest>[0];
  requisition: PurchaseRequisition;
  lines: RequestLine[];
  purchaseOrder?: PurchaseOrder;
}

interface ErrorResponse { error?: string; code?: string }

/** Submit once to the atomic endpoint; safe retries return the same aggregate. */
export async function submitGovernedCheckout(input: SubmitGovernedCheckoutInput): Promise<SubmitGovernedCheckoutResult> {
  const response = await fetch('/api/governed-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.json() as SubmitGovernedCheckoutResult & ErrorResponse;
  if (!response.ok) {
    const error = new Error(body.error ?? 'Governed checkout could not be completed.');
    error.name = body.code ?? 'governed_checkout_error';
    throw error;
  }
  return body;
}
