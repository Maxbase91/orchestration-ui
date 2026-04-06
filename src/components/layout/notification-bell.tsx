import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NotificationBell() {
  const navigate = useNavigate();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative h-8 w-8"
      onClick={() => navigate('/notifications')}
      aria-label="Notifications"
    >
      <Bell className="h-4.5 w-4.5 text-text-secondary" />
      <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-status-danger text-[10px] font-semibold text-white">
        5
      </span>
    </Button>
  );
}
