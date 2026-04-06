import { cn } from '@/lib/utils';

interface PriorityIndicatorProps {
  priority: 'low' | 'medium' | 'high' | 'urgent';
  showLabel?: boolean;
}

const priorityConfig = {
  low: { color: 'bg-gray-400', label: 'Low' },
  medium: { color: 'bg-blue-500', label: 'Medium' },
  high: { color: 'bg-amber-500', label: 'High' },
  urgent: { color: 'bg-red-500', label: 'Urgent' },
} as const;

export function PriorityIndicator({ priority, showLabel = false }: PriorityIndicatorProps) {
  const config = priorityConfig[priority];

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('size-2 rounded-full shrink-0', config.color)} />
      {showLabel && (
        <span className="text-sm text-muted-foreground">{config.label}</span>
      )}
    </span>
  );
}
