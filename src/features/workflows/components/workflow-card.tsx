import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import { getUserById } from '@/data/users';
import type { ProcurementRequest } from '@/data/types';
import {
  ArrowUp,
  ArrowRight,
  ArrowDown,
  AlertTriangle,
} from 'lucide-react';

const priorityConfig: Record<string, { icon: typeof ArrowUp; color: string }> = {
  urgent: { icon: AlertTriangle, color: 'text-red-600' },
  high: { icon: ArrowUp, color: 'text-amber-600' },
  medium: { icon: ArrowRight, color: 'text-blue-500' },
  low: { icon: ArrowDown, color: 'text-gray-400' },
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

  const requestor = getUserById(request.requestorId);
  const owner = getUserById(request.ownerId);
  const priority = priorityConfig[request.priority] ?? priorityConfig.medium;
  const PriorityIcon = priority.icon;

  const isApproachingSLA = request.daysInStage >= 4 && !request.isOverdue;
  const borderClass = request.isOverdue
    ? 'border-red-400'
    : isApproachingSLA
      ? 'border-amber-400'
      : 'border-gray-200';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'rounded-md border bg-white p-3 shadow-sm cursor-grab active:cursor-grabbing',
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

      <p className="mt-1 text-sm font-medium text-gray-900 line-clamp-2 leading-tight">
        {request.title}
      </p>

      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{requestor?.name ?? 'Unknown'}</span>
        <span className="font-medium text-gray-700">
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
              ? 'text-red-600'
              : isApproachingSLA
                ? 'text-amber-600'
                : 'text-gray-500',
          )}
        >
          {request.daysInStage}d in stage
        </span>
      </div>
    </div>
  );
}
