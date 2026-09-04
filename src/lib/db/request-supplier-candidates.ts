// Data access for `request_supplier_candidates` — the suppliers a requester
// named as worth inviting to sourcing.
//
// `requests.supplier_id` holds exactly one supplier, the preferred one that the
// determination runs against; these are the alternates. Written once, when the
// request is created, and read by sourcing.
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
