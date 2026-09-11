// The shortlist of suppliers a request carries into sourcing.
//
// There was no hook at all: the list was written at submission and read by
// nothing, so every supplier chosen beyond the first vanished from the product.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addRequestSupplierCandidate,
  listRequestSupplierCandidates,
  removeRequestSupplierCandidate,
} from '@/lib/db/request-supplier-candidates';

const KEY = 'request-supplier-candidates';

export function useRequestSupplierCandidates(requestId: string | undefined) {
  return useQuery({
    queryKey: [KEY, requestId],
    queryFn: () => listRequestSupplierCandidates(requestId as string),
    enabled: Boolean(requestId),
  });
}

export function useAddRequestSupplierCandidate(requestId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (supplierId: string) => addRequestSupplierCandidate(requestId, supplierId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, requestId] }),
  });
}

export function useRemoveRequestSupplierCandidate(requestId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (supplierId: string) => removeRequestSupplierCandidate(requestId, supplierId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, requestId] }),
  });
}
