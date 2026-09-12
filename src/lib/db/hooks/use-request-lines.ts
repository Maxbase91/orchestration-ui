// The lines behind a request, for the screens that check an order is complete.
import { useQuery } from '@tanstack/react-query';
import { listRequestLines } from '@/lib/db/request-lines';

export function useRequestLinesForRequest(requestId: string | undefined) {
  return useQuery({
    queryKey: ['request-lines', requestId],
    queryFn: () => listRequestLines(requestId as string),
    enabled: Boolean(requestId),
  });
}
