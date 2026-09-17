import { cn } from '@/lib/utils';

interface PriorityIndicatorProps {
  priority: 'low' | 'medium' | 'high' | 'urgent';
  showLabel?: boolean;
}

const priorityConfig = {
  low: { color: 'bg-idle', label: 'Low' },
  medium: { color: 'bg-accent-solid', label: 'Medium' },
  high: { color: 'bg-warn', label: 'High' },
  urgent: { color: 'bg-stop', label: 'Urgent' },
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
