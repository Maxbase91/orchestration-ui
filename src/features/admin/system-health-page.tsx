import { CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { BarChartWidget } from '@/components/charts/bar-chart-widget';

interface Integration {
  name: string;
  status: 'connected';
  lastSync: string;
  uptime: string;
}

const integrations: Integration[] = [
  { name: 'SAP', status: 'connected', lastSync: '2 min ago', uptime: '99.98%' },
  { name: 'TPRM System', status: 'connected', lastSync: '5 min ago', uptime: '99.95%' },
  { name: 'Screening Service', status: 'connected', lastSync: '1 min ago', uptime: '99.99%' },
  { name: 'Email Service', status: 'connected', lastSync: '30 sec ago', uptime: '99.97%' },
];

const requestVolumeData = [
  { name: 'Mon', value: 12 },
  { name: 'Tue', value: 18 },
  { name: 'Wed', value: 15 },
  { name: 'Thu', value: 22 },
  { name: 'Fri', value: 19 },
  { name: 'Sat', value: 4 },
  { name: 'Sun', value: 2 },
];

interface ErrorLogEntry {
  timestamp: string;
  severity: string;
  service: string;
  message: string;
  status: string;
  [key: string]: unknown;
}

const errorLog: ErrorLogEntry[] = [
  {
    timestamp: '2026-04-06 08:45:12',
    severity: 'Warning',
    service: 'SAP Integration',
    message: 'Retry on connection timeout (attempt 2/3)',
    status: 'Resolved',
  },
  {
    timestamp: '2026-04-05 22:15:03',
    severity: 'Error',
    service: 'Email Service',
    message: 'SMTP relay failure for notification batch #4821',
    status: 'Resolved',
  },
  {
    timestamp: '2026-04-05 14:32:47',
    severity: 'Warning',
    service: 'Screening Service',
    message: 'Response latency exceeded 5s threshold',
    status: 'Resolved',
  },
  {
    timestamp: '2026-04-04 11:08:55',
    severity: 'Error',
    service: 'TPRM System',
    message: 'API rate limit reached (429)',
    status: 'Investigating',
  },
  {
    timestamp: '2026-04-03 16:22:19',
    severity: 'Warning',
    service: 'SAP Integration',
    message: 'Data sync mismatch on PO-0024 (auto-corrected)',
    status: 'Resolved',
  },
];

const errorColumns: Column<ErrorLogEntry>[] = [
  { key: 'timestamp', label: 'Timestamp', sortable: true },
  {
    key: 'severity',
    label: 'Severity',
    render: (item) => (
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
          item.severity === 'Error'
            ? 'bg-red-100 text-red-700'
            : 'bg-amber-100 text-amber-700'
        }`}
      >
        {item.severity as string}
      </span>
    ),
  },
  { key: 'service', label: 'Service' },
  { key: 'message', label: 'Message' },
  {
    key: 'status',
    label: 'Status',
    render: (item) => <StatusBadge status={item.status as string} size="sm" />,
  },
];

export function SystemHealthPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="System Health"
        subtitle="Monitor integrations, performance, and errors"
      />

      {/* Integration Status */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-gray-900">
          Integration Status
        </h3>
        <div className="grid grid-cols-4 gap-4">
          {integrations.map((intg) => (
            <Card key={intg.name} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="size-2 rounded-full bg-green-500" />
                <p className="text-sm font-medium">{intg.name}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-green-600 mb-1">
                <CheckCircle className="size-3.5" />
                Connected
              </div>
              <div className="space-y-0.5 text-xs text-muted-foreground">
                <p>Last sync: {intg.lastSync}</p>
                <p>Uptime: {intg.uptime}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Request Volume */}
      <Card className="p-4">
        <h3 className="mb-4 text-sm font-medium text-gray-900">
          Request Volume (Last 7 Days)
        </h3>
        <BarChartWidget
          data={requestVolumeData}
          dataKeys={[{ key: 'value', color: '#6366F1', label: 'Requests' }]}
          height={250}
        />
      </Card>

      {/* System Metrics */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-gray-900">
          System Metrics
        </h3>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Active Sessions', value: '47' },
            { label: 'Avg Response Time', value: '120ms' },
            { label: 'Error Rate', value: '0.02%' },
            { label: 'Uptime', value: '99.97%' },
          ].map((metric) => (
            <Card key={metric.label} className="p-4 text-center">
              <p className="text-2xl font-semibold">{metric.value}</p>
              <p className="text-xs text-muted-foreground">{metric.label}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Error Log */}
      <Card className="p-4">
        <h3 className="mb-4 text-sm font-medium text-gray-900">
          Recent Error Log
        </h3>
        <DataTable columns={errorColumns} data={errorLog} />
      </Card>
    </div>
  );
}
