import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SystemIntegration, IntegrationStatus } from '@/data/system-integrations';
import { systemColors } from '@/data/system-integrations';

interface SystemIntegrationBadgeProps {
  integration: SystemIntegration;
  compact?: boolean;
}

const statusConfig: Record<IntegrationStatus, { label: string; dotClass: string; icon?: typeof CheckCircle }> = {
  'pending-handover': { label: 'Pending handover', dotClass: 'bg-gray-400 animate-pulse' },
  'submitted': { label: 'Submitted', dotClass: 'bg-amber-400' },
  'awaiting-response': { label: 'Awaiting response', dotClass: 'bg-amber-400 animate-pulse' },
  'processing': { label: 'Processing', dotClass: 'bg-amber-400' },
  'completed': { label: 'Completed', dotClass: 'bg-green-500', icon: CheckCircle },
  'error': { label: 'Error', dotClass: 'bg-red-500', icon: XCircle },
  'timeout': { label: 'Timeout', dotClass: 'bg-red-500', icon: Clock },
};

function getCompactLabel(integration: SystemIntegration): string {
  const systemShort = integration.system === 'coupa-risk' ? 'Coupa' :
    integration.system === 'ariba' ? 'Ariba' :
    integration.system === 'sirion' ? 'Sirion' : 'SAP';

  switch (integration.status) {
    case 'completed': return `${systemShort} Complete`;
    case 'error': return `${systemShort} Error`;
    case 'timeout': return `${systemShort} Timeout`;
    case 'awaiting-response': return `Awaiting ${systemShort}`;
    case 'processing': return `${systemShort} Processing`;
    case 'submitted': return `Sent to ${systemShort}`;
    case 'pending-handover': return `Pending ${systemShort}`;
    default: return systemShort;
  }
}

function getCompactIcon(status: IntegrationStatus): string {
  switch (status) {
    case 'completed': return '✓';
    case 'error': return '✗';
    case 'timeout': return '⏱';
    default: return '⏳';
  }
}

export function SystemIntegrationBadge({ integration, compact = false }: SystemIntegrationBadgeProps) {
  const config = statusConfig[integration.status];
  const colors = systemColors[integration.system];

  if (compact) {
    return (
      <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium', colors)}>
        <span>{getCompactIcon(integration.status)}</span>
        {getCompactLabel(integration)}
      </span>
    );
  }

  return (
    <div className={cn('rounded-md border p-3', colors)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {integration.status === 'processing' ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : config.icon ? (
            <config.icon className="size-3.5" />
          ) : (
            <span className={cn('size-2 rounded-full', config.dotClass)} />
          )}
          <span className="text-xs font-semibold">{integration.systemLabel}</span>
        </div>
        <span className="text-[10px] font-medium opacity-80">{config.label}</span>
      </div>

      {integration.referenceId && (
        <p className="mt-1 text-[11px] font-mono opacity-70">{integration.referenceId}</p>
      )}

      <p className="mt-1 text-[11px] opacity-80">{integration.detail}</p>

      <div className="mt-1.5 flex items-center gap-3 text-[10px] opacity-60">
        <span>Submitted: {new Date(integration.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        {integration.respondedAt && (
          <span>Responded: {new Date(integration.respondedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        )}
      </div>
    </div>
  );
}
