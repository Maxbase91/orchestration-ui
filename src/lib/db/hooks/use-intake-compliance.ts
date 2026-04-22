import { useQuery } from '@tanstack/react-query';
import { getIntakeCompliance } from '../intake-compliance';

const KEYS = {
  byRequest: (requestId: string) => ['intake-compliance', 'request', requestId] as const,
};

export function useIntakeCompliance(requestId: string | undefined) {
  return useQuery({
    queryKey: KEYS.byRequest(requestId ?? ''),
    queryFn: () => getIntakeCompliance(requestId!),
    enabled: Boolean(requestId),
  });
}
