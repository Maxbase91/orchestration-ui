import { cn } from '@/lib/utils';

interface TimelineEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  detail?: string;
  type: 'system' | 'human' | 'ai' | 'warning' | 'block';
}

interface TimelineProps {
  events: TimelineEvent[];
}

const typeStyles: Record<TimelineEvent['type'], { dot: string; text: string }> = {
  system: { dot: 'bg-gray-400', text: 'text-gray-600' },
  human: { dot: 'bg-blue-500', text: 'text-blue-700' },
  ai: { dot: 'bg-purple-500', text: 'text-purple-700' },
  warning: { dot: 'bg-amber-500', text: 'text-amber-700' },
  block: { dot: 'bg-red-500', text: 'text-red-700' },
};

export function Timeline({ events }: TimelineProps) {
  return (
    <div className="relative space-y-0">
      {events.map((event, index) => {
        const style = typeStyles[event.type];
        const isLast = index === events.length - 1;

        return (
          <div key={event.id} className="relative flex gap-3 pb-4">
            {/* Connecting line */}
            {!isLast && (
              <div className="absolute left-[5px] top-3 h-full w-px bg-gray-200" />
            )}
            {/* Dot */}
            <div className={cn('relative mt-1.5 size-[10px] shrink-0 rounded-full', style.dot)} />
            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className={cn('text-sm font-medium', style.text)}>{event.actor}</span>
                <span className="text-sm text-gray-700">{event.action}</span>
              </div>
              {event.detail && (
                <p className="mt-0.5 text-xs text-muted-foreground">{event.detail}</p>
              )}
              <p className="mt-0.5 text-[10px] text-muted-foreground">{event.timestamp}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export type { TimelineEvent };
