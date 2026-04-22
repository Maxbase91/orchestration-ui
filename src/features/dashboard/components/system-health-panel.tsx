import { useMemo } from 'react';
import { Settings, AlertTriangle } from 'lucide-react';
import { useRequests } from '@/lib/db/hooks/use-requests';
import { KPICard } from '@/components/shared/kpi-card';

export function SystemHealthPanel() {
  const { data: requests = [] } = useRequests();
  const requestVolume = useMemo(() => {
    // Simulate: today = 3, this week = 8, this month = 15
    const total = requests.length;
    return { today: 3, week: 8, month: total };
  }, [requests.length]);

  return (
    <div className="grid grid-cols-3 gap-4">
      <KPICard
        label="Active Users"
        value={47}
        trend={{ direction: 'up', percentage: 12 }}
      />
      <KPICard
        label="Request Volume"
        value={`${requestVolume.today} / ${requestVolume.week} / ${requestVolume.month}`}
        trend={{ direction: 'up', percentage: 6 }}
      />
      <div className="rounded-md bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
        <p className="text-xs font-medium text-muted-foreground">API Status</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-green-500" />
          </span>
          <p className="text-2xl font-semibold text-gray-900">Healthy</p>
        </div>
        <p className="mt-0.5 text-xs text-gray-500">All systems operational</p>
      </div>
    </div>
  );
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  detail: string;
}

const recentChanges: AuditLogEntry[] = [
  { id: '1', timestamp: '2025-01-08T09:30:00Z', user: 'Elena Popov', action: 'Updated routing rule', detail: 'Modified threshold for IT consulting from EUR 100K to EUR 150K' },
  { id: '2', timestamp: '2025-01-08T08:15:00Z', user: 'Elena Popov', action: 'Created workflow template', detail: 'Added "Express PO" workflow for catalogue purchases under EUR 10K' },
  { id: '3', timestamp: '2025-01-07T16:45:00Z', user: 'James Chen', action: 'Disabled AI agent', detail: 'Disabled "Duplicate Detector v1" agent for retraining' },
  { id: '4', timestamp: '2025-01-07T14:00:00Z', user: 'Elena Popov', action: 'Updated approval chain', detail: 'Added VP Finance to approval chain for requests > EUR 500K' },
  { id: '5', timestamp: '2025-01-07T11:30:00Z', user: 'Elena Popov', action: 'Modified SLA config', detail: 'Extended validation SLA from 5 to 7 business days' },
  { id: '6', timestamp: '2025-01-06T17:00:00Z', user: 'James Chen', action: 'Added commodity code', detail: 'Added 83101800 "Renewable energy services" to code library' },
  { id: '7', timestamp: '2025-01-06T15:20:00Z', user: 'Elena Popov', action: 'Updated user role', detail: 'Promoted Lisa Nakamura to Senior Supplier Manager' },
  { id: '8', timestamp: '2025-01-06T10:00:00Z', user: 'Elena Popov', action: 'Created routing rule', detail: 'New rule: "Contingent labour > EUR 200K requires VP approval"' },
  { id: '9', timestamp: '2025-01-05T14:30:00Z', user: 'James Chen', action: 'Enabled AI agent', detail: 'Enabled "Category Classifier v3" with 94.2% accuracy' },
  { id: '10', timestamp: '2025-01-05T09:00:00Z', user: 'Elena Popov', action: 'Updated system config', detail: 'Set default currency display to EUR for all dashboards' },
];

export function RecentChangesLog() {
  return (
    <div className="space-y-2">
      {recentChanges.map((entry) => (
        <div key={entry.id} className="flex items-start gap-3 rounded border border-gray-100 bg-white p-3">
          <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-gray-50 text-gray-400">
            <Settings className="size-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="font-medium text-gray-700">{entry.user}</span>
              <span>&middot;</span>
              <span>{new Date(entry.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p className="mt-0.5 text-sm font-medium text-gray-900">{entry.action}</p>
            <p className="mt-0.5 text-xs text-gray-500">{entry.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConfigurationAlerts() {
  const alerts = [
    { icon: AlertTriangle, label: '2 routing rules have never fired', severity: 'warning' as const },
    { icon: Settings, label: '1 workflow has an unused branch', severity: 'info' as const },
  ];

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => {
        const Icon = alert.icon;
        return (
          <div
            key={i}
            className={`flex items-center gap-3 rounded-md p-3 ${
              alert.severity === 'warning' ? 'bg-amber-50 border border-amber-100' : 'bg-blue-50 border border-blue-100'
            }`}
          >
            <Icon className={`size-4 shrink-0 ${alert.severity === 'warning' ? 'text-amber-500' : 'text-blue-500'}`} />
            <p className={`text-sm ${alert.severity === 'warning' ? 'text-amber-700' : 'text-blue-700'}`}>{alert.label}</p>
          </div>
        );
      })}
    </div>
  );
}
