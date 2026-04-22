import { useQuery } from '@tanstack/react-query';
import { listStageHistory, listStageHistoryByRequest } from '../stage-history';

const KEYS = {
  all: ['stage-history'] as const,
  list: () => ['stage-history', 'list'] as const,
  byRequest: (requestId: string) => ['stage-history', 'request', requestId] as const,
};

export function useStageHistory() {
  return useQuery({
    queryKey: KEYS.list(),
    queryFn: listStageHistory,
  });
}

export function useStageHistoryByRequest(requestId: string | undefined) {
  return useQuery({
    queryKey: KEYS.byRequest(requestId ?? ''),
    queryFn: () => listStageHistoryByRequest(requestId!),
    enabled: Boolean(requestId),
  });
}
