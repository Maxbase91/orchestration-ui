import { PageHeader } from '@/components/shared/page-header';
import { BottleneckChart } from '@/features/workflows/components/bottleneck-chart';
import { StuckRequestsTable } from '@/features/workflows/components/stuck-requests-table';
import { AIBottleneckAnalysis } from '@/features/workflows/components/ai-bottleneck-analysis';
import { useRequests } from '@/lib/db/hooks/use-requests';
import { AlertTriangle, Clock, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const escalations = [
  {
    id: 'ESC-001',
    title: 'REQ-2024-0014 - McKinsey Org Design',
    escalatedBy: 'Marcus Johnson',
    escalatedTo: 'Christine Dupont',
    reason: 'VP approval pending >14 days. Value exceeds EUR 1.8M.',
    when: '2025-01-03T10:00:00Z',
    severity: 'high' as const,
  },
  {
    id: 'ESC-002',
    title: 'REQ-2024-0007 - Java Developer Staffing',
    escalatedBy: 'Anna Muller',
    escalatedTo: 'Dr. Katrin Bauer',
    reason: 'Finance approval pending >60 days. Programme board confirmation stalled.',
    when: '2025-01-05T14:30:00Z',
    severity: 'critical' as const,
  },
  {
    id: 'ESC-003',
    title: 'REQ-2024-0023 - Siemens IoT Sensors',
    escalatedBy: 'Sarah Chen',
    escalatedTo: 'Dr. Katrin Bauer',
    reason: 'ROI review pending >25 days. Manufacturing timeline at risk.',
    when: '2025-01-06T09:00:00Z',
    severity: 'high' as const,
  },
  {
    id: 'ESC-004',
    title: 'SUP-021 - TechBridge Onboarding',
    escalatedBy: 'Lisa Nakamura',
    escalatedTo: 'David Kowalski',
    reason: 'Supplier screening pending >30 days. High risk rating unresolved.',
    when: '2025-01-04T16:00:00Z',
    severity: 'medium' as const,
  },
];

const severityConfig = {
  critical: { color: 'border-l-red-600 bg-red-50', badge: 'bg-red-100 text-red-700', icon: AlertTriangle },
  high: { color: 'border-l-orange-500 bg-orange-50', badge: 'bg-orange-100 text-orange-700', icon: ArrowUpRight },
  medium: { color: 'border-l-yellow-500 bg-yellow-50', badge: 'bg-yellow-100 text-yellow-700', icon: Clock },
};

function formatEscalationDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function BottlenecksPage() {
  const { data: requests = [] } = useRequests();

  return (
    <div className="space-y-6">
      <PageHeader title="Bottlenecks & Alerts" subtitle="Identify and resolve process delays" />

      <div className="grid gap-6 lg:grid-cols-2">
        <BottleneckChart requests={requests} />
        <div className="space-y-4">
          <AIBottleneckAnalysis />
        </div>
      </div>

      <StuckRequestsTable requests={requests} />

      <div className="rounded-md border bg-white shadow-sm">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Escalation Management</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Active escalations requiring attention</p>
        </div>
        <div className="divide-y">
          {escalations.map((esc) => {
            const config = severityConfig[esc.severity];
            const Icon = config.icon;
            return (
              <div key={esc.id} className={cn('border-l-4 px-4 py-3', config.color)}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Icon className="size-4 mt-0.5 shrink-0 text-gray-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{esc.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{esc.reason}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Escalated by <span className="font-medium">{esc.escalatedBy}</span> to{' '}
                        <span className="font-medium">{esc.escalatedTo}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize', config.badge)}>
                      {esc.severity}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatEscalationDate(esc.when)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
