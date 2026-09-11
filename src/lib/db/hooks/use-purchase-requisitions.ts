// The requisition behind a request, for the screens that explain its governance.
import { useQuery } from '@tanstack/react-query';
import { getRequisitionForRequest } from '@/lib/db/purchase-requisitions';

export function useRequisitionForRequest(requestId: string | undefined) {
  return useQuery({
    queryKey: ['purchase-requisitions', 'by-request', requestId],
    queryFn: () => getRequisitionForRequest(requestId as string),
    enabled: Boolean(requestId),
  });
}
