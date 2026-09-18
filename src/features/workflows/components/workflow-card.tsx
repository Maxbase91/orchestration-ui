// Draggable request card for the workflow kanban board — one card per request,
// sortable within/between stage columns via dnd-kit.
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import { useUserLookup, useUsers } from '@/lib/db/hooks/use-users';
import type { ProcurementRequest } from '@/data/types';
import {
  ArrowUp,
  ArrowRight,
  ArrowDown,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { useComplianceReport } from '@/lib/db/hooks/use-compliance-reports';
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: request.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  useUsers();
  const lookupUser = useUserLookup();
  const requestor = lookupUser(request.requestorId);
  const owner = lookupUser(request.ownerId);
  const priority = priorityConfig[request.priority] ?? priorityConfig.medium;
  const PriorityIcon = priority.icon;

  const { data: complianceReport } = useComplianceReport(request.id);
  const { data: integrations = [] } = useIntegrationsByRequest(request.id);
  const activeIntegration = integrations.find((i) => i.status !== 'completed');

  const isApproachingSLA = request.daysInStage >= 4 && !request.isOverdue;
  const borderClass = request.isOverdue
    ? 'border-stop-line'
    : isApproachingSLA
      ? 'border-warn-line'
      : 'border-line';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'rounded-md border bg-card p-3 shadow-sm cursor-grab active:cursor-grabbing',
        'hover:shadow-md transition-shadow',
        borderClass,
        isDragging && 'opacity-50 shadow-lg',
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="text-[11px] font-mono text-muted-foreground">
          {request.id}
        </span>
        <PriorityIcon className={cn('size-3.5 shrink-0', priority.color)} />
      </div>

      <p className="mt-1 text-sm font-medium text-ink line-clamp-2 leading-tight">
        {request.title}
      </p>

      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{requestor?.name ?? 'Unknown'}</span>
        <span className="font-medium text-ink-2">
          {formatCurrency(request.value, request.currency)}
        </span>
      </div>

      <div className="mt-1.5 flex items-center justify-between text-xs">
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
      </div>

      {(complianceReport || activeIntegration) && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {complianceReport && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft border border-accent-line px-2 py-0.5 text-[10px] font-medium text-accent-solid">
              <Sparkles className="size-2.5" />
              AI Reviewed
            </span>
          )}
          {activeIntegration && (
            <SystemIntegrationBadge integration={activeIntegration} compact />
          )}
        </div>
      )}
    </div>
  );
}
