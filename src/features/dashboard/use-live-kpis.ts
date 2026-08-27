import { useMemo } from 'react';
import type { ProcurementRequest } from '@/data/types';
import { useRequests } from '@/lib/db/hooks/use-requests';
import { useSourcingEvents } from '@/lib/db/hooks/use-sourcing-events';
import type { SourcingEvent } from '@/lib/db/sourcing-events';
import { EVALUATABLE_EVENT_STATUSES } from '@/lib/procurement/sourcing-award';

const OPEN_STATUSES = new Set(['intake', 'validation', 'approval', 'sourcing', 'referred-back']);
const MONTHS_BACK = 6;

function monthKey(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

function lastNMonths(n: number, from: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}


/** A live event: published through award-pending. Drafts and closed events are not activity. */
function isActiveSourcing(e: SourcingEvent): boolean {
  return EVALUATABLE_EVENT_STATUSES.includes(e.status);
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
  const { data: events = [] } = useSourcingEvents();
  return useMemo(() => compute(requests, events), [requests, events]);
}

function compute(requests: ProcurementRequest[], events: SourcingEvent[]): LiveKpis {
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
  // Use the average across all non-zero months rather than current-month only,
  // so the metric is non-zero even when the current calendar month has few completions.
  const nonZeroSeries = cycleTimeSeries.filter(v => v > 0);
  const avgCycleTime = nonZeroSeries.length > 0
    ? Math.round(nonZeroSeries.reduce((a, b) => a + b, 0) / nonZeroSeries.length)
    : 0;
  const cycleTimeTrend = trend(cycleTimeSeries);

  // ── active sourcing: live sourcing EVENTS, not requests parked in the stage.
  // This counted requests with status='sourcing' while sourcing_events fed no
  // metric at all — so the tile reported demand waiting to be sourced and called
  // it sourcing activity. A request sitting in the stage with no event raised is
  // precisely the thing this number should not be counting.
  const sourcingSeries = months.map(
    (m) => events.filter((e) => isActiveSourcing(e) && monthKey(e.createdAt) === m).length,
  );
  const activeSourcing = events.filter(isActiveSourcing).length;
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
