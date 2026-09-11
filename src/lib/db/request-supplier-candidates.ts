// Data access for `request_supplier_candidates` — the suppliers a requester
// named as worth inviting to sourcing.
//
// `requests.supplier_id` holds the supplier the determination screened against;
// this table is the shortlist that goes to sourcing. It stayed editable after
// submission on purpose — category management routinely adds suppliers the
// requester did not know about, and a shortlist fixed at intake would mean
// re-keying them into the event instead.
//
// It was written at submission and read by nothing at all until now, so every
// supplier a requester picked beyond the first was captured and then lost.
import { db } from '@/lib/db-client';

export interface RequestSupplierCandidate {
  requestId: string;
  supplierId: string;
  isPreferred: boolean;
}

const TABLE = 'request_supplier_candidates';

export async function listRequestSupplierCandidates(requestId: string): Promise<RequestSupplierCandidate[]> {
  const { data, error } = await db.from(TABLE).select('*').eq('request_id', requestId);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    requestId: row.request_id as string,
    supplierId: row.supplier_id as string,
    isPreferred: (row.is_preferred as boolean) ?? false,
  }));
}

/**
 * Record the candidate set for a request.
 *
 * Upsert on the composite key so a retried submission does not duplicate rows —
 * the request id is the same on a retry, which is what makes this idempotent.
 */
export async function saveRequestSupplierCandidates(
  candidates: RequestSupplierCandidate[],
): Promise<void> {
  if (candidates.length === 0) return;
  const { error } = await db.from(TABLE).upsert(
    candidates.map((candidate) => ({
      request_id: candidate.requestId,
      supplier_id: candidate.supplierId,
      is_preferred: candidate.isPreferred,
    })),
    { onConflict: 'request_id,supplier_id' },
  );
  if (error) throw error;
}

/** Add one supplier to a request's shortlist. Idempotent on the composite key. */
export async function addRequestSupplierCandidate(
  requestId: string,
  supplierId: string,
): Promise<void> {
  await saveRequestSupplierCandidates([{ requestId, supplierId, isPreferred: false }]);
}

/**
 * Remove one supplier from a request's shortlist.
 *
 * Deliberately not cascading to a sourcing event that already invited them: an
 * invitation is a thing that happened, and withdrawing it is a separate act
 * with its own record.
 */
export async function removeRequestSupplierCandidate(
  requestId: string,
  supplierId: string,
): Promise<void> {
  const { error } = await db.from(TABLE).delete()
    .eq('request_id', requestId).eq('supplier_id', supplierId);
  if (error) throw error;
}
