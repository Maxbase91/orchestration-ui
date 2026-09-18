// Compact notification feed for the dashboard: icon/colour per notification
// type, capped to the latest few, with an unread dot. Read-only — acting on a
// notification happens on the notifications page.
import { Bell, MessageSquare, AlertTriangle, ArrowRight, Sparkles, Shield } from 'lucide-react';
import { formatRelativeTime } from '@/lib/format';
import type { Notification } from '@/data/types';

interface RecentActivityFeedProps {
  notifications: Notification[];
  limit?: number;
}

const typeIcons: Record<Notification['type'], React.ElementType> = {
  'approval-request': Bell,
  'status-update': ArrowRight,
  'sla-warning': AlertTriangle,
  'escalation': AlertTriangle,
  'comment': MessageSquare,
  'system-alert': Shield,
  'ai-insight': Sparkles,
};

const typeColors: Record<Notification['type'], string> = {
  'approval-request': 'text-accent-solid bg-accent-soft',
  'status-update': 'text-ok bg-ok-soft',
  'sla-warning': 'text-warn bg-warn-soft',
  'escalation': 'text-stop bg-stop-soft',
  'comment': 'text-ink-3 bg-card-2',
  'system-alert': 'text-accent-solid bg-accent-soft',
  'ai-insight': 'text-accent-solid bg-accent-soft',
};

export function RecentActivityFeed({ notifications, limit = 5 }: RecentActivityFeedProps) {
  const items = notifications.slice(0, limit);

  return (
    <div className="space-y-3">
      {items.map((n) => {
        const Icon = typeIcons[n.type];
        const colorClass = typeColors[n.type];
        return (
          <div key={n.id} className="flex items-start gap-3">
            <div className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${colorClass}`}>
              <Icon className="size-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink truncate">{n.title}</p>
              <p className="mt-0.5 text-xs text-ink-3 line-clamp-1">{n.description}</p>
              <p className="mt-0.5 text-xs text-ink-3">{formatRelativeTime(n.timestamp)}</p>
            </div>
            {!n.isRead && (
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent-solid" />
            )}
          </div>
        );
      })}
    </div>
  );
}
