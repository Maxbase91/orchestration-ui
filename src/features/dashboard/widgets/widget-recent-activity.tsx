import { useNotifications } from '@/lib/db/hooks/use-notifications';
import { RecentActivityFeed } from '../components/recent-activity-feed';

export function WidgetRecentActivity() {
  const { data: notifications = [] } = useNotifications();
  return <RecentActivityFeed notifications={notifications} limit={5} />;
}
