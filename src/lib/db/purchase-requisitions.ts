// Reading the purchase requisition a governed checkout wrote.
//
// There was no read path at all: the requisition carries the contract the spend
// was called off against and the evidence that the match was checked —
// contract_scope_version_id, contract_match_score, contract_match_reasons, the
// algorithm version and the input fingerprint — and every one of those was
// written by api/governed-checkout.ts and rendered nowhere. The Compliance tab,
// whose job is to justify the governance decision, never named the contract.
import { db } from '@/lib/db-client';
import { mapDbToPurchaseRequisition } from './mappers';
import type { PurchaseRequisition } from '@/data/types';

const TABLE = 'purchase_requisitions';

/** The requisition for a request. One per request — the table enforces it. */
export async function getRequisitionForRequest(
  requestId: string,
): Promise<PurchaseRequisition | null> {
  const { data, error } = await db.from(TABLE).select('*').eq('request_id', requestId).maybeSingle();
  if (error) throw error;
  return data ? mapDbToPurchaseRequisition(data) : null;
}
