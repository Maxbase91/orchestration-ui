// A request's card on the Active Workflows board — one per request, opening the
// request. The board is view-only (decided 2026-09-26): cards were draggable,
// and a drop moved the request to any stage past its gates, forms and
// approvals. A stage moves on the request page, through its stage action.
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import { useUserLookup, useUsers } from '@/lib/db/hooks/use-users';
import type { ProcurementRequest } from '@/data/types';
import {
  ArrowUp,
  ArrowRight,
  ArrowDown,
  AlertTriangle,
} from 'lucide-react';
import { useIntegrationsByRequest } from '@/lib/db/hooks/use-system-integrations';
import { SystemIntegrationBadge } from '@/components/shared/system-integration-badge';

const priorityConfig: Record<string, { icon: typeof ArrowUp; color: string }> = {
  urgent: { icon: AlertTriangle, color: 'text-stop' },
  high: { icon: ArrowUp, color: 'text-warn' },
  medium: { icon: ArrowRight, color: 'text-accent-solid' },
  low: { icon: ArrowDown, color: 'text-ink-3' },
};

interface WorkflowCardProps {
  request: ProcurementRequest;
  onClick?: () => void;
}

export function WorkflowCard({ request, onClick }: WorkflowCardProps) {
  useUsers();
  const lookupUser = useUserLookup();
  const requestor = lookupUser(request.requestorId);
  const owner = lookupUser(request.ownerId);
  const priority = priorityConfig[request.priority] ?? priorityConfig.medium;
  const PriorityIcon = priority.icon;

  const { data: integrations = [] } = useIntegrationsByRequest(request.id);
  const activeIntegration = integrations.find((i) => i.status !== 'completed');

  const isApproachingSLA = request.daysInStage >= 4 && !request.isOverdue;
  const borderClass = request.isOverdue
    ? 'border-stop-line'
    : isApproachingSLA
      ? 'border-warn-line'
      : 'border-line';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open ${request.id}: ${request.title}`}
      className={cn(
        'w-full rounded-md border bg-card p-3 text-left shadow-sm',
        'hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-solid',
        borderClass,
      )}
    >
      <span className="flex items-start justify-between gap-1">
        <span className="text-[11px] font-mono text-muted-foreground">
          {request.id}
        </span>
        <PriorityIcon className={cn('size-3.5 shrink-0', priority.color)} />
      </span>

      <span className="mt-1 block text-sm font-medium text-ink line-clamp-2 leading-tight">
        {request.title}
      </span>

      <span className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{requestor?.name ?? 'Unknown'}</span>
        <span className="font-medium text-ink-2">
          {formatCurrency(request.value, request.currency)}
        </span>
      </span>

      <span className="mt-1.5 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          Owner: {owner?.initials ?? '—'}
        </span>
        <span
          className={cn(
            'font-medium',
            request.isOverdue
              ? 'text-stop'
              : isApproachingSLA
                ? 'text-warn'
                : 'text-ink-3',
          )}
        >
          {request.daysInStage}d in stage
        </span>
      </span>

      {activeIntegration && (
        <span className="mt-2 flex items-center gap-2 flex-wrap">
          <SystemIntegrationBadge integration={activeIntegration} compact />
        </span>
      )}
    </button>
  );
}
