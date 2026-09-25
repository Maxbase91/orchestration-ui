// The approvers a request will actually get, before it has any.
//
// The review screen used to resolve each chain step with resolveApprover — the
// six-persona collapse — and then dedupe by persona, so a three-step chain
// whose roles all map to procurement-manager showed as one name. It promised
// approvers that differed from the ones the request would be given, which is
// how the screen could name Dr. Katrin Bauer while somebody else held the
// entry. Same derivation as the write path, so the preview is the promise.
import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/db-client';
import { deriveApprovalsFor, type ApprovalRequestContext } from '@/lib/db/approvals-core';
import type { DerivedApproval } from '@/lib/procurement/approval-derivation';

export function useDerivedApprovers(
  context: ApprovalRequestContext | null,
  chainId: string | undefined,
) {
  return useQuery<DerivedApproval[]>({
    queryKey: ['derived-approvers', chainId, context?.category, context?.contractId, context?.costCentre, context?.supplierOverride],
    queryFn: () => deriveApprovalsFor(db, context as ApprovalRequestContext, chainId),
    enabled: Boolean(context && chainId),
    // Nobody has been asked yet, so there is nothing to keep fresh; this only
    // changes when the admin reassigns a category or the value band moves.
    staleTime: 60_000,
  });
}
