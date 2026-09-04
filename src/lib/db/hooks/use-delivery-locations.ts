import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DeliveryLocation } from '@/lib/db/delivery-locations';
import { listDeliveryLocations, upsertDeliveryLocation, deleteDeliveryLocation } from '@/lib/db/delivery-locations';

const KEYS = {
  all: ['delivery-locations'] as const,
  list: () => ['delivery-locations', 'list'] as const,
};

export function useDeliveryLocations() {
  return useQuery({ queryKey: KEYS.list(), queryFn: listDeliveryLocations, staleTime: 5 * 60 * 1000 });
}

export function useUpsertDeliveryLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (location: DeliveryLocation) => upsertDeliveryLocation(location),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useDeleteDeliveryLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDeliveryLocation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}
