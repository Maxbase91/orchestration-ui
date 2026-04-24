import { useMemo } from 'react';
import type { ProcurementRequest, Invoice, StageHistoryEntry } from '@/data/types';
import { useRequests } from '@/lib/db/hooks/use-requests';
import { useInvoices } from '@/lib/db/hooks/use-invoices';
import { useStageHistory } from '@/lib/db/hooks/use-stage-history';

const MONTHS_BACK = 6;

function monthKey(iso?: string): string {
  return iso ? iso.slice(0, 7) : '';
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
function currentYear(): string {
  return String(new Date().getFullYear());
}

const MANAGED_CHANNELS = new Set(['procurement-led', 'framework-call-off']);

// ── Spend ───────────────────────────────────────────────────────────

export interface LiveSpendKpis {
  totalSpendYTD: number;
  totalSpendMonthlySeries: { month: string; value: number }[];
  managedSpendYTD: number;
  managedPct: number;
  managedSeries: number[];
}

function computeSpend(requests: ProcurementRequest[], invoices: Invoice[]): LiveSpendKpis {
  const year = currentYear();
  const months = lastNMonths(MONTHS_BACK);

  // Total spend = sum of completed request values year-to-date. Completed
  // is the terminal success status in the 9-stage lifecycle.
  const ytdCompleted = requests.filter(
    (r) => r.status === 'completed' && monthKey(r.updatedAt ?? r.createdAt).startsWith(year),
  );
  const totalSpendYTD = ytdCompleted.reduce((sum, r) => sum + (r.value ?? 0), 0);
  const managedSpendYTD = ytdCompleted
    .filter((r) => MANAGED_CHANNELS.has(r.buyingChannel as string))
    .reduce((sum, r) => sum + (r.value ?? 0), 0);
  const managedPct = totalSpendYTD > 0
    ? Math.round((managedSpendYTD / totalSpendYTD) * 100)
    : 0;

  // Monthly spend series uses invoices (single source of truth for
  // actual spend, whether via catalogue, contract, or full request).
  const totalSpendMonthlySeries = months.map((m) => {
    const val = invoices
      .filter((inv) => monthKey(inv.invoiceDate) === m)
      .reduce((s, inv) => s + (inv.amount ?? 0), 0);
    return { month: m.slice(5), value: val };
  });

  // Managed-% series per month, bounded to [0,100]. Returns 0 when the
  // month has no completed requests.
  const managedSeries = months.map((m) => {
    const monthCompleted = requests.filter(
      (r) => r.status === 'completed' && monthKey(r.updatedAt ?? r.createdAt) === m,
    );
    const total = monthCompleted.reduce((s, r) => s + (r.value ?? 0), 0);
    const managed = monthCompleted
      .filter((r) => MANAGED_CHANNELS.has(r.buyingChannel as string))
      .reduce((s, r) => s + (r.value ?? 0), 0);
    return total > 0 ? Math.round((managed / total) * 100) : 0;
  });

  return {
    totalSpendYTD,
    totalSpendMonthlySeries,
    managedSpendYTD,
    managedPct,
    managedSeries,
  };
}

export function useLiveSpendKpis(): LiveSpendKpis {
  const { data: requests = [] } = useRequests();
  const { data: invoices = [] } = useInvoices();
  return useMemo(() => computeSpend(requests, invoices), [requests, invoices]);
}

// ── Pipeline throughput ─────────────────────────────────────────────

export interface LivePipelineKpis {
  openDemand: number;
  activeSourcing: number;
  completedYTD: number;
  throughputSeries: number[]; // completed count per month
  submittedSeries: number[];  // submitted count per month
  cycleTimeByStage: { name: string; value: number }[]; // avg days per stage from stage_history
}

// Stages rendered on the Pipeline dashboard. Matches the lifecycle
// enum used across the app.
const PIPELINE_STAGES: { key: string; label: string }[] = [
  { key: 'intake', label: 'Intake' },
  { key: 'validation', label: 'Validation' },
  { key: 'approval', label: 'Approval' },
  { key: 'sourcing', label: 'Sourcing' },
  { key: 'contracting', label: 'Contracting' },
  { key: 'po', label: 'PO' },
  { key: 'receipt', label: 'Receipt' },
  { key: 'invoice', label: 'Invoice' },
  { key: 'payment', label: 'Payment' },
];

function computeCycleTimeByStage(history: StageHistoryEntry[]): { name: string; value: number }[] {
  const buckets = new Map<string, { total: number; count: number }>();
  for (const h of history) {
    if (!h.completedAt || !h.enteredAt) continue;
    const start = new Date(h.enteredAt).getTime();
    const end = new Date(h.completedAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
    const days = (end - start) / 86_400_000;
    const b = buckets.get(h.stage) ?? { total: 0, count: 0 };
    b.total += days;
    b.count += 1;
    buckets.set(h.stage, b);
  }
  // Emit in pipeline order; stages with no completed entries return 0
  return PIPELINE_STAGES.map(({ key, label }) => {
    const b = buckets.get(key);
    return {
      name: label,
      value: b && b.count > 0 ? Math.round(b.total / b.count) : 0,
    };
  });
}

const OPEN_STATUSES = new Set(['intake', 'validation', 'approval', 'sourcing', 'referred-back']);

function computePipeline(
  requests: ProcurementRequest[],
  stageHistory: StageHistoryEntry[],
): LivePipelineKpis {
  const year = currentYear();
  const months = lastNMonths(MONTHS_BACK);

  const openDemand = requests.filter((r) => OPEN_STATUSES.has(r.status)).length;
  const activeSourcing = requests.filter((r) => r.status === 'sourcing').length;
  const completedYTD = requests.filter(
    (r) => r.status === 'completed' && monthKey(r.updatedAt ?? r.createdAt).startsWith(year),
  ).length;

  const throughputSeries = months.map((m) =>
    requests.filter(
      (r) => r.status === 'completed' && monthKey(r.updatedAt ?? r.createdAt) === m,
    ).length,
  );
  const submittedSeries = months.map((m) =>
    requests.filter((r) => monthKey(r.createdAt) === m).length,
  );

  const cycleTimeByStage = computeCycleTimeByStage(stageHistory);

  return { openDemand, activeSourcing, completedYTD, throughputSeries, submittedSeries, cycleTimeByStage };
}

export function useLivePipelineKpis(): LivePipelineKpis {
  const { data: requests = [] } = useRequests();
  const { data: stageHistory = [] } = useStageHistory();
  return useMemo(() => computePipeline(requests, stageHistory), [requests, stageHistory]);
}

// ── Compliance ─────────────────────────────────────────────────────

export interface LiveComplianceKpis {
  firstTimeRight: number;            // % of completed requests with refer_back_count === 0
  firstTimeRightSeries: number[];
  policyBreaches: number;            // current-month count of refer-back events (proxy)
  policyBreachesSeries: number[];
  referBackRate: number;             // completed requests / avg refer_back_count
}

function computeCompliance(requests: ProcurementRequest[]): LiveComplianceKpis {
  const months = lastNMonths(MONTHS_BACK);

  const completed = requests.filter((r) => r.status === 'completed');
  const ftrCount = completed.filter((r) => (r.referBackCount ?? 0) === 0).length;
  const firstTimeRight = completed.length > 0
    ? Math.round((ftrCount / completed.length) * 100)
    : 0;

  const firstTimeRightSeries = months.map((m) => {
    const monthCompleted = completed.filter(
      (r) => monthKey(r.updatedAt ?? r.createdAt) === m,
    );
    if (monthCompleted.length === 0) return 0;
    const ftr = monthCompleted.filter((r) => (r.referBackCount ?? 0) === 0).length;
    return Math.round((ftr / monthCompleted.length) * 100);
  });

  // Policy breaches per month: requests that were referred back ≥1 time
  // and entered their current stage in that month.
  const policyBreachesSeries = months.map((m) => {
    return requests.filter(
      (r) => (r.referBackCount ?? 0) > 0 && monthKey(r.createdAt) === m,
    ).length;
  });
  const policyBreaches = policyBreachesSeries[policyBreachesSeries.length - 1] ?? 0;

  const totalReferBacks = completed.reduce((s, r) => s + (r.referBackCount ?? 0), 0);
  const referBackRate = completed.length > 0
    ? Math.round((totalReferBacks / completed.length) * 100) / 100
    : 0;

  return {
    firstTimeRight,
    firstTimeRightSeries,
    policyBreaches,
    policyBreachesSeries,
    referBackRate,
  };
}

export function useLiveComplianceKpis(): LiveComplianceKpis {
  const { data: requests = [] } = useRequests();
  return useMemo(() => computeCompliance(requests), [requests]);
}
