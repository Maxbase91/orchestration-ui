import { notifications } from '@/data/notifications';
import { RecentActivityFeed } from '../components/recent-activity-feed';

export function WidgetRecentActivity() {
  return <RecentActivityFeed notifications={notifications} limit={5} />;
}
