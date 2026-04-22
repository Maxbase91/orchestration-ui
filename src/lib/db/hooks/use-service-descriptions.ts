import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getServiceDescription, saveServiceDescription } from '../service-descriptions';
import type { ServiceDescriptionRecord } from '../mappers';

const KEYS = {
  all: ['service-descriptions'] as const,
  byRequest: (requestId: string) => ['service-descriptions', 'request', requestId] as const,
};

export function useServiceDescription(requestId: string | undefined) {
  return useQuery({
    queryKey: KEYS.byRequest(requestId ?? ''),
    queryFn: () => getServiceDescription(requestId!),
    enabled: Boolean(requestId),
  });
}

export function useSaveServiceDescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, sow }: {
      requestId: string;
      sow: Omit<ServiceDescriptionRecord, 'requestId'>;
    }) => saveServiceDescription(requestId, sow),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: KEYS.byRequest(variables.requestId) });
    },
  });
}
