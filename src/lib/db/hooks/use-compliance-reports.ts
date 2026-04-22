import { useQuery } from '@tanstack/react-query';
import { getComplianceReportByRequest } from '../compliance-reports';

const KEYS = {
  byRequest: (requestId: string) => ['compliance-reports', 'request', requestId] as const,
};

export function useComplianceReport(requestId: string | undefined) {
  return useQuery({
    queryKey: KEYS.byRequest(requestId ?? ''),
    queryFn: () => getComplianceReportByRequest(requestId!),
    enabled: Boolean(requestId),
  });
}
