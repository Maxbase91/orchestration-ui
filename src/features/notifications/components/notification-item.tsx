import { useState } from 'react';
import {
  CheckCircle,
  RefreshCw,
  AlertTriangle,
  ArrowUp,
  MessageSquare,
  Shield,
  Sparkles,
  Clock,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import type { Notification } from '@/data/types';

const typeConfig: Record<
  Notification['type'],
  { icon: typeof CheckCircle; color: string; bg: string }
> = {
  'approval-request': { icon: CheckCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
  'status-update': { icon: RefreshCw, color: 'text-blue-600', bg: 'bg-blue-50' },
  'sla-warning': { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
  escalation: { icon: ArrowUp, color: 'text-red-600', bg: 'bg-red-50' },
  comment: { icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50' },
  'system-alert': { icon: Shield, color: 'text-gray-600', bg: 'bg-gray-50' },
  'ai-insight': { icon: Sparkles, color: 'text-purple-600', bg: 'bg-purple-50' },
};

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
}

export function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const config = typeConfig[notification.type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'group relative flex gap-3 rounded-lg border p-3 transition-colors',
        notification.isRead ? 'bg-white border-gray-100' : 'bg-blue-50/30 border-blue-100',
        'hover:bg-gray-50 cursor-pointer'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onMarkRead(notification.id)}
    >
      {/* Unread indicator */}
      {!notification.isRead && (
        <div className="absolute top-3.5 left-1 size-2 rounded-full bg-blue-500" />
      )}

      {/* Type icon */}
      <div className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full', config.bg)}>
        <Icon className={cn('size-4', config.color)} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm', notification.isRead ? 'font-normal' : 'font-semibold')}>
          {notification.title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
          {notification.description}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatRelativeTime(notification.timestamp)}
        </p>
      </div>

      {/* Hover actions */}
      {isHovered && (
        <div className="absolute top-2 right-2 flex gap-1">
          {!notification.isRead && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onMarkRead(notification.id);
              }}
            >
              <Eye className="mr-1 size-3" />
              Mark read
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <Clock className="mr-1 size-3" />
            Snooze
          </Button>
        </div>
      )}
    </div>
  );
}
