import { useQuery } from '@tanstack/react-query';
import type { KPIDataPoint } from '@/data/types';
import { listKpiData } from '../kpi-data';

const KEYS = {
  list: () => ['kpi-data', 'list'] as const,
};

export function useKpiData() {
  return useQuery({ queryKey: KEYS.list(), queryFn: listKpiData });
}

/**
 * Returns the latest KPI snapshot from the cached list, or undefined if the
 * list hasn't loaded. Pair with `useKpiData()` in the same component.
 */
export function useLatestKpi(): KPIDataPoint | undefined {
  const { data } = useKpiData();
  if (!data || data.length === 0) return undefined;
  // Assumes the list is already sorted ascending by month from the server.
  return data[data.length - 1];
}
