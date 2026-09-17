import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SystemIntegration, IntegrationStatus } from '@/data/system-integrations';
import { systemColors } from '@/data/system-integrations';

interface SystemIntegrationTimelineProps {
  integrations: SystemIntegration[];
}

const statusConfig: Record<IntegrationStatus, { label: string; dotClass: string }> = {
  'pending-handover': { label: 'Pending handover', dotClass: 'bg-idle' },
  'submitted': { label: 'Submitted', dotClass: 'bg-warn' },
  'awaiting-response': { label: 'Awaiting response', dotClass: 'bg-warn' },
  'processing': { label: 'Processing', dotClass: 'bg-warn' },
  'completed': { label: 'Completed', dotClass: 'bg-ok' },
  'error': { label: 'Error — manual intervention required', dotClass: 'bg-stop' },
  'timeout': { label: 'Timeout — no response', dotClass: 'bg-stop' },
};

function getDuration(submittedAt: string, respondedAt: string): string {
  const ms = new Date(respondedAt).getTime() - new Date(submittedAt).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  const minutes = Math.floor(ms / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusIcon({ status }: { status: IntegrationStatus }) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="size-3.5 text-ok" />;
    case 'error':
      return <XCircle className="size-3.5 text-stop" />;
    case 'timeout':
      return <Clock className="size-3.5 text-stop" />;
    case 'processing':
      return <Loader2 className="size-3.5 text-warn animate-spin" />;
    default:
      return null;
  }
}

export function SystemIntegrationTimeline({ integrations }: SystemIntegrationTimelineProps) {
  const sorted = [...integrations].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );

  return (
    <div className="relative space-y-0">
      {sorted.map((integration, index) => {
        const config = statusConfig[integration.status];
        const colors = systemColors[integration.system];
        const isLast = index === sorted.length - 1;

        return (
          <div key={integration.id} className="relative flex gap-3 pb-4">
            {/* Connecting line */}
            {!isLast && (
              <div className="absolute left-[5px] top-3 h-full w-px bg-line" />
            )}
            {/* Dot */}
            <div className={cn('relative mt-1.5 size-[10px] shrink-0 rounded-full', config.dotClass)} />
            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', colors)}>
                  {integration.systemLabel}
                </span>
                <div className="flex items-center gap-1">
                  <StatusIcon status={integration.status} />
                  <span className="text-xs text-ink-2">{config.label}</span>
                </div>
                {integration.referenceId && (
                  <span className="text-[10px] font-mono text-muted-foreground">{integration.referenceId}</span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-ink-2">{integration.detail}</p>
              <div className="mt-0.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                <span>Submitted: {formatTimestamp(integration.submittedAt)}</span>
                {integration.respondedAt && (
                  <>
                    <span>Responded: {formatTimestamp(integration.respondedAt)}</span>
                    <span className="font-medium text-ink-3">
                      Duration: {getDuration(integration.submittedAt, integration.respondedAt)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
