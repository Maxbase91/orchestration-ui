import { useMemo } from 'react';
import type { ProcurementRequest } from '@/data/types';
import { useRequests } from '@/lib/db/hooks/use-requests';

const OPEN_STATUSES = new Set(['intake', 'validation', 'approval', 'sourcing', 'referred-back']);
const MONTHS_BACK = 6;

function monthKey(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

function lastNMonths(n: number): string[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

function trend(series: number[]): { direction: 'up' | 'down' | 'flat'; percentage: number } {
  if (series.length < 2) return { direction: 'flat', percentage: 0 };
  const cur = series[series.length - 1];
  const prev = series[series.length - 2];
  if (prev === 0) return { direction: cur > 0 ? 'up' : 'flat', percentage: cur > 0 ? 100 : 0 };
  const delta = ((cur - prev) / Math.abs(prev)) * 100;
  const direction = Math.abs(delta) < 0.5 ? 'flat' : delta > 0 ? 'up' : 'down';
  return { direction, percentage: Math.round(Math.abs(delta)) };
}

export interface LiveKpis {
  complianceRate: number;
  complianceSeries: number[];
  complianceTrend: ReturnType<typeof trend>;

  avgCycleTime: number;
  cycleTimeSeries: number[];
  cycleTimeTrend: ReturnType<typeof trend>;

  activeSourcing: number;
  sourcingSeries: number[];
  sourcingTrend: ReturnType<typeof trend>;

  openDemandCount: number;
  openDemandValue: number;
  openDemandSeries: number[];
  openDemandTrend: ReturnType<typeof trend>;
}

export function useLiveKpis(): LiveKpis {
  const { data: requests = [] } = useRequests();
  return useMemo(() => compute(requests), [requests]);
}

function compute(requests: ProcurementRequest[]): LiveKpis {
  const months = lastNMonths(MONTHS_BACK);

  // ── compliance: % of completed requests in each month with refer_back_count === 0
  const complianceSeries = months.map((m) => {
    const completed = requests.filter(
      (r) => r.status === 'completed' && monthKey(r.updatedAt ?? r.createdAt) === m,
    );
    if (completed.length === 0) return 0;
    const firstTimeRight = completed.filter((r) => (r.referBackCount ?? 0) === 0).length;
    return Math.round((firstTimeRight / completed.length) * 100);
  });
  const complianceRate = complianceSeries[complianceSeries.length - 1] ?? 0;
  const complianceTrend = trend(complianceSeries);

  // ── avg cycle time: days from createdAt → updatedAt, bucketed by completion month
  const cycleTimeSeries = months.map((m) => {
    const completed = requests.filter(
      (r) => r.status === 'completed' && monthKey(r.updatedAt ?? r.createdAt) === m,
    );
    if (completed.length === 0) return 0;
    const total = completed.reduce((sum, r) => {
      const start = new Date(r.createdAt).getTime();
      const end = new Date(r.updatedAt ?? r.createdAt).getTime();
      return sum + Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
    }, 0);
    return Math.round(total / completed.length);
  });
  const avgCycleTime = cycleTimeSeries[cycleTimeSeries.length - 1] ?? 0;
  const cycleTimeTrend = trend(cycleTimeSeries);

  // ── active sourcing: requests currently in sourcing (current month cross-section
  // for the sparkline uses requests whose createdAt month matches, but since status
  // is a "now" value, the only honest sparkline is end-of-month-in-sourcing counts;
  // approximate with per-month new sourcing entries)
  const sourcingSeries = months.map((m) => {
    return requests.filter(
      (r) => r.status === 'sourcing' && monthKey(r.createdAt) === m,
    ).length;
  });
  const activeSourcing = requests.filter((r) => r.status === 'sourcing').length;
  const sourcingTrend = trend(sourcingSeries);

  // ── open demand: count + total value of open-stage requests per month (by creation)
  const openDemandSeries = months.map((m) => {
    return requests.filter(
      (r) => OPEN_STATUSES.has(r.status) && monthKey(r.createdAt) === m,
    ).length;
  });
  const open = requests.filter((r) => OPEN_STATUSES.has(r.status));
  const openDemandCount = open.length;
  const openDemandValue = open.reduce((sum, r) => sum + (r.value ?? 0), 0);
  const openDemandTrend = trend(openDemandSeries);

  return {
    complianceRate,
    complianceSeries,
    complianceTrend,
    avgCycleTime,
    cycleTimeSeries,
    cycleTimeTrend,
    activeSourcing,
    sourcingSeries,
    sourcingTrend,
    openDemandCount,
    openDemandValue,
    openDemandSeries,
    openDemandTrend,
  };
}
