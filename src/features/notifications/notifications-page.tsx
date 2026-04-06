import { useState, useMemo } from 'react';
import { CheckCheck } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { notifications as initialNotifications } from '@/data/notifications';
import { NotificationFeed } from './components/notification-feed';
import { NotificationPreferences } from './components/notification-preferences';
import type { Notification } from '@/data/types';

const filterTabs: { value: string; label: string; type?: Notification['type'] }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'approval-request', label: 'Approval Requests', type: 'approval-request' },
  { value: 'status-update', label: 'Status Updates', type: 'status-update' },
  { value: 'sla-warning', label: 'SLA Warnings', type: 'sla-warning' },
  { value: 'ai-insight', label: 'AI Insights', type: 'ai-insight' },
];

export function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>(() =>
    [...initialNotifications].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  );
  const [activeTab, setActiveTab] = useState('all');

  const unreadCount = useMemo(() => items.filter((n) => !n.isRead).length, [items]);

  function handleMarkRead(id: string) {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  }

  function handleMarkAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  const filtered = useMemo(() => {
    if (activeTab === 'all') return items;
    if (activeTab === 'unread') return items.filter((n) => !n.isRead);
    return items.filter((n) => n.type === activeTab);
  }, [items, activeTab]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        badge={
          unreadCount > 0 ? (
            <Badge variant="secondary" className="text-xs">
              {unreadCount} unread
            </Badge>
          ) : undefined
        }
        actions={
          <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
            <CheckCheck className="mr-1.5 size-4" />
            Mark All Read
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {filterTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        {filterTabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <NotificationFeed notifications={filtered} onMarkRead={handleMarkRead} />
          </TabsContent>
        ))}

        <TabsContent value="preferences">
          <NotificationPreferences />
        </TabsContent>
      </Tabs>
    </div>
  );
}
