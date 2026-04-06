import { parseISO, isToday, isYesterday } from 'date-fns';
import { NotificationItem } from './notification-item';
import type { Notification } from '@/data/types';

interface NotificationFeedProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
}

function groupByDate(items: Notification[]): { label: string; items: Notification[] }[] {
  const groups: Record<string, Notification[]> = {};

  for (const item of items) {
    const date = parseISO(item.timestamp);
    let label: string;

    if (isToday(date)) {
      label = 'Today';
    } else if (isYesterday(date)) {
      label = 'Yesterday';
    } else {
      label = 'Earlier';
    }

    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  }

  const order = ['Today', 'Yesterday', 'Earlier'];
  return order
    .filter((label) => groups[label]?.length)
    .map((label) => ({ label, items: groups[label] }));
}

export function NotificationFeed({ notifications, onMarkRead }: NotificationFeedProps) {
  const groups = groupByDate(notifications);

  if (notifications.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        No notifications to display.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.label}>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {group.label}
          </h3>
          <div className="space-y-2">
            {group.items.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkRead={onMarkRead}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
