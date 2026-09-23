// A request's priority: a dot, and its name.
//
// With `showLabel` off this rendered a bare coloured dot and nothing else — no
// text, no title, no accessible name — so the only way to read a priority was
// to tell amber from red. The name is now always present: visible when there is
// room for it, and otherwise announced to a screen reader and shown on hover.
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
  const config = priorityConfig[priority] ?? priorityConfig.medium;

  return (
    <span className="inline-flex items-center gap-1.5" title={showLabel ? undefined : `${config.label} priority`}>
      <span className={cn('size-2 shrink-0 rounded-full', config.color)} aria-hidden="true" />
      {showLabel
        ? <span className="text-caption text-ink-2">{config.label}</span>
        : <span className="sr-only">{config.label} priority</span>}
    </span>
  );
}
