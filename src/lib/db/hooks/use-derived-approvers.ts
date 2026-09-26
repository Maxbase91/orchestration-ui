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
import { chainIdFor, deriveApprovalsFor, type ApprovalRequestContext } from '@/lib/db/approvals-core';
import type { DerivedApproval } from '@/lib/procurement/approval-derivation';
import { usePolicyConfig } from '@/lib/procurement/use-policy-config';
import { useApprovalChains } from './use-approval-chains';

export function useDerivedApprovers(
  context: ApprovalRequestContext | null,
  chainId: string | undefined,
) {
  return useQuery<DerivedApproval[]>({
    // The route too: a call-off's prepends the contract owner, so it must not
    // share an answer with a full request on the same chain.
    queryKey: ['derived-approvers', chainId, context?.route, context?.category, context?.contractId, context?.costCentre, context?.supplierOverride],
    queryFn: () => deriveApprovalsFor(db, context as ApprovalRequestContext, chainId),
    enabled: Boolean(context && chainId),
    // Nobody has been asked yet, so there is nothing to keep fresh; this only
    // changes when the admin reassigns a category or the value band moves.
    staleTime: 60_000,
  });
}

/**
 * The approvers submit will write, chain and all.
 *
 * The chain is chosen the way both writers choose it — the one the
 * determination pinned, else the value band, under the governed thresholds —
 * and then derived exactly as they derive it. The Review step picked its own
 * chain from the band alone and left out the cost centre, so it could name
 * people submit would not ask.
 */
export function useApproversOnSubmit(
  context: ApprovalRequestContext | null,
  explicitChain: string | null | undefined,
  value: number,
) {
  const { data: chains, isSuccess } = useApprovalChains();
  const config = usePolicyConfig();
  const chainId = isSuccess && chains ? chainIdFor(explicitChain, chains, value, config) : undefined;
  return useDerivedApprovers(context, chainId);
}
