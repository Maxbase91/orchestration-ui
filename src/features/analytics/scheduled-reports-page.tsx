import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

interface ReportRow extends Record<string, unknown> {
  id: string;
  name: string;
  frequency: string;
  schedule: string;
  lastRun: string;
  nextRun: string;
  recipients: string;
  enabled: boolean;
}

const initialReports: ReportRow[] = [
  {
    id: 'rpt-1',
    name: 'Weekly Spend Summary',
    frequency: 'Weekly',
    schedule: 'Mon 08:00',
    lastRun: '2026-03-30T08:00:00Z',
    nextRun: '2026-04-06T08:00:00Z',
    recipients: 'procurement-team@company.com',
    enabled: true,
  },
  {
    id: 'rpt-2',
    name: 'Monthly Compliance Report',
    frequency: 'Monthly',
    schedule: '1st of month',
    lastRun: '2026-04-01T06:00:00Z',
    nextRun: '2026-05-01T06:00:00Z',
    recipients: 'compliance@company.com, cpo@company.com',
    enabled: true,
  },
  {
    id: 'rpt-3',
    name: 'Supplier Risk Assessment',
    frequency: 'Quarterly',
    schedule: '1st of quarter',
    lastRun: '2026-01-01T06:00:00Z',
    nextRun: '2026-07-01T06:00:00Z',
    recipients: 'risk-committee@company.com',
    enabled: true,
  },
  {
    id: 'rpt-4',
    name: 'Pipeline Status Report',
    frequency: 'Daily',
    schedule: '18:00',
    lastRun: '2026-04-05T18:00:00Z',
    nextRun: '2026-04-06T18:00:00Z',
    recipients: 'ops-lead@company.com',
    enabled: true,
  },
  {
    id: 'rpt-5',
    name: 'Contract Renewal Alerts',
    frequency: 'Weekly',
    schedule: 'Fri 09:00',
    lastRun: '2026-04-04T09:00:00Z',
    nextRun: '2026-04-11T09:00:00Z',
    recipients: 'contract-managers@company.com',
    enabled: false,
  },
];

function formatReportDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ScheduledReportsPage() {
  const [reports, setReports] = useState(initialReports);

  const toggleReport = (id: string) => {
    setReports((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const next = { ...r, enabled: !r.enabled };
          toast.success(`${next.name} ${next.enabled ? 'enabled' : 'disabled'}`);
          return next;
        }
        return r;
      })
    );
  };

  const columns: Column<ReportRow>[] = [
    {
      key: 'name',
      label: 'Report Name',
      sortable: true,
      render: (row) => <span className="text-sm font-medium">{row.name as string}</span>,
    },
    {
      key: 'frequency',
      label: 'Frequency',
      render: (row) => (
        <span className="text-sm">{row.frequency as string}</span>
      ),
    },
    {
      key: 'schedule',
      label: 'Schedule',
      render: (row) => <span className="text-xs text-muted-foreground">{row.schedule as string}</span>,
    },
    {
      key: 'lastRun',
      label: 'Last Run',
      sortable: true,
      render: (row) => <span className="text-xs">{formatReportDate(row.lastRun as string)}</span>,
    },
    {
      key: 'nextRun',
      label: 'Next Run',
      sortable: true,
      render: (row) => <span className="text-xs">{formatReportDate(row.nextRun as string)}</span>,
    },
    {
      key: 'recipients',
      label: 'Recipients',
      render: (row) => (
        <span className="text-xs text-muted-foreground max-w-[200px] truncate block">
          {row.recipients as string}
        </span>
      ),
    },
    {
      key: 'enabled',
      label: 'Status',
      render: (row) => (
        <Switch
          checked={row.enabled as boolean}
          onCheckedChange={() => toggleReport(row.id as string)}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scheduled Reports"
        subtitle="Manage automated report generation and distribution"
        actions={
          <Button onClick={() => toast.info('Report creation wizard coming soon')}>
            <Plus className="size-4 mr-1" />
            Create New
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={reports}
        emptyMessage="No scheduled reports configured."
      />
    </div>
  );
}
