// TanStack Query hook for requester procurement defaults used by checkout.
import { useQuery } from '@tanstack/react-query';
import { getProcurementProfile } from '../procurement-profiles';

export function useProcurementProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['procurement-profile', userId ?? ''],
    queryFn: () => getProcurementProfile(userId!),
    enabled: Boolean(userId),
  });
}
