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
  'approval-request': 'text-blue-500 bg-blue-50',
  'status-update': 'text-green-500 bg-green-50',
  'sla-warning': 'text-amber-500 bg-amber-50',
  'escalation': 'text-red-500 bg-red-50',
  'comment': 'text-gray-500 bg-gray-50',
  'system-alert': 'text-purple-500 bg-purple-50',
  'ai-insight': 'text-blue-500 bg-blue-50',
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
              <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
              <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{n.description}</p>
              <p className="mt-0.5 text-xs text-gray-400">{formatRelativeTime(n.timestamp)}</p>
            </div>
            {!n.isRead && (
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500" />
            )}
          </div>
        );
      })}
    </div>
  );
}
