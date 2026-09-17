// Admin — what the platform can actually say about its upstream handovers.
//
// This page used to report four green "Connected" cards, a 7-day request-volume
// chart, 99.97% uptime, a 0.02% error rate, 47 active sessions and a five-row
// error log. Every one of those was a literal in this file. Two of the cards
// were contradicted by the store as they rendered — SAP Ariba had a handover in
// `timeout`, Coupa Risk one in `error` — and an admin looking here to find out
// whether anything was wrong was told, in green, that nothing was.
//
// There is no uptime to report and no sessions to count. R1 has no live
// connections (CLAUDE.md, ground rule 2), so "connected" is not a fact this
// platform holds. What it holds is `system_integrations`: one row per handover,
// the status it reached, and when it came back. That is what this shows, and
// where a figure does not exist it is absent rather than invented.
import { AlertTriangle, CheckCircle, Clock, Loader2, MinusCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { useSystemIntegrations } from '@/lib/db/hooks/use-system-integrations';
import { systemLabels, type SystemIntegration } from '@/data/system-integrations';
import {
  systemHealth, failedHandovers, humaniseMinutes, type SystemHealth,
} from '@/lib/procurement/integration-health';
import { formatDate } from '@/lib/format';

/** The systems the platform hands over to, from the shared label map. */
const SYSTEMS = Object.entries(systemLabels).map(([system, label]) => ({ system, label }));

const STATE_STYLE: Record<SystemHealth['state'], { dot: string; text: string; icon: typeof CheckCircle; label: string }> = {
  failing: { dot: 'bg-red-500', text: 'text-red-600', icon: AlertTriangle, label: 'Handovers failing' },
  waiting: { dot: 'bg-amber-500', text: 'text-amber-600', icon: Clock, label: 'Awaiting response' },
  healthy: { dot: 'bg-green-500', text: 'text-green-600', icon: CheckCircle, label: 'All completed' },
  unused: { dot: 'bg-gray-300', text: 'text-gray-500', icon: MinusCircle, label: 'No handovers yet' },
};

type FailureRow = SystemIntegration & Record<string, unknown>;

const failureColumns: Column<FailureRow>[] = [
  {
    key: 'submittedAt',
    label: 'Submitted',
    sortable: true,
    render: (item) => <span className="tabular-nums">{formatDate(item.submittedAt as string)}</span>,
  },
  { key: 'systemLabel', label: 'System' },
  { key: 'requestId', label: 'Request' },
  { key: 'stage', label: 'Stage' },
  {
    key: 'status',
    label: 'Status',
    render: (item) => <StatusBadge status={item.status as string} size="sm" />,
  },
  // The stored explanation, not a severity we made up for it.
  { key: 'detail', label: 'Detail' },
];

export function SystemHealthPage() {
  const { data: integrations = [], isLoading, isError } = useSystemIntegrations();

  const health = systemHealth(integrations, SYSTEMS);
  const failures = failedHandovers(integrations);
  const open = health.reduce((sum, h) => sum + h.open, 0);
  const completed = health.reduce((sum, h) => sum + h.completed, 0);
  const answered = health.filter((h) => h.meanResponseMinutes !== null);
  const meanResponse = answered.length > 0
    ? Math.round(answered.reduce((s, h) => s + (h.meanResponseMinutes ?? 0), 0) / answered.length)
    : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" /> <span className="text-sm">Loading handover records…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integration Health"
        subtitle="What happened to the handovers this platform recorded"
      />

      {/* An unreadable table and a platform with nothing to hand over look the
          same on a card. Saying which is the whole job of this screen. */}
      {isError && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-700" />
          <div className="text-sm text-red-900">
            <p className="font-medium">Handover records could not be read</p>
            <p className="mt-0.5 text-xs text-red-800">
              Nothing below is a measurement. The figures are absent rather than shown as zeroes.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
        This release has <span className="font-medium">no live upstream connections</span>. Each
        record below is a handover the platform prepared for an external system and the outcome it
        recorded — not a health check against a running service. There is no uptime, error rate or
        session count to report, so none is shown.
      </div>

      {/* Per-system summary */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-gray-900">Handovers by system</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {health.map((h) => {
            const style = STATE_STYLE[h.state];
            const Icon = style.icon;
            return (
              <Card key={h.system} className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className={`size-2 rounded-full ${style.dot}`} />
                  <p className="text-sm font-medium">{h.label}</p>
                </div>
                <div className={`mb-1 flex items-center gap-1 text-xs ${style.text}`}>
                  <Icon className="size-3.5" />
                  {style.label}
                </div>
                <div className="space-y-0.5 text-xs text-muted-foreground">
                  <p className="tabular-nums">
                    {h.completed} completed · {h.open} open
                    {h.failed > 0 && <span className="font-medium text-red-600"> · {h.failed} failed</span>}
                  </p>
                  <p>
                    Last handover:{' '}
                    {h.lastActivity ? formatDate(h.lastActivity) : 'never'}
                  </p>
                  {/* Absent, not zero, when nothing has come back. */}
                  <p>Mean response: {humaniseMinutes(h.meanResponseMinutes)}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Totals — each one a count of rows, not a rate nobody measures. */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-gray-900">Across all systems</h3>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: 'Handovers recorded', value: String(integrations.length) },
            { label: 'Completed', value: String(completed) },
            { label: 'Awaiting a response', value: String(open) },
            { label: 'Mean response time', value: humaniseMinutes(meanResponse) },
          ].map((metric) => (
            <Card key={metric.label} className="p-4 text-center">
              <p className="text-2xl font-semibold tabular-nums">{metric.value}</p>
              <p className="text-xs text-muted-foreground">{metric.label}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* The real error log: the handovers that did not land, with the detail
          the record itself carries. The five rows that used to be here were
          invented, down to the timestamps. */}
      <Card className="p-4">
        <h3 className="mb-4 text-sm font-medium text-gray-900">
          Handovers that did not land{failures.length > 0 && ` (${failures.length})`}
        </h3>
        {failures.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No handover has failed or timed out.
          </p>
        ) : (
          <DataTable columns={failureColumns} data={failures as FailureRow[]} />
        )}
      </Card>
    </div>
  );
}
