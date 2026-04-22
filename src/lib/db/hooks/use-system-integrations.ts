import { useQuery } from '@tanstack/react-query';
import { listIntegrationsByRequest, listSystemIntegrations } from '../system-integrations';

const KEYS = {
  list: () => ['system-integrations', 'list'] as const,
  byRequest: (requestId: string) => ['system-integrations', 'request', requestId] as const,
};

export function useSystemIntegrations() {
  return useQuery({
    queryKey: KEYS.list(),
    queryFn: listSystemIntegrations,
  });
}

export function useIntegrationsByRequest(requestId: string | undefined) {
  return useQuery({
    queryKey: KEYS.byRequest(requestId ?? ''),
    queryFn: () => listIntegrationsByRequest(requestId!),
    enabled: Boolean(requestId),
  });
}

/**
 * Synchronous lookup from cached list (for components that need a
 * by-request filter without triggering a new query per component).
 * Pair with `useSystemIntegrations()` in the same component.
 */
export function useIntegrationsLookup() {
  const { data } = useSystemIntegrations();
  return (requestId: string | undefined) => {
    if (!requestId) return [];
    return (data ?? []).filter((i) => i.requestId === requestId);
  };
}
