import { Link } from 'react-router-dom';
import { Plus, Search, Sparkles, UserCog, ArrowUpCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuickAction {
  label: string;
  icon: React.ElementType;
  to?: string;
  onClick?: () => void;
  variant?: 'default' | 'outline' | 'ghost';
}

interface QuickActionsProps {
  actions: QuickAction[];
}

export function QuickActions({ actions }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => {
        const Icon = action.icon;
        if (action.to) {
          return (
            <Button key={action.label} variant={action.variant ?? 'outline'} size="sm" asChild>
              <Link to={action.to}>
                <Icon className="size-4" />
                {action.label}
              </Link>
            </Button>
          );
        }
        return (
          <Button
            key={action.label}
            variant={action.variant ?? 'outline'}
            size="sm"
            onClick={action.onClick}
          >
            <Icon className="size-4" />
            {action.label}
          </Button>
        );
      })}
    </div>
  );
}

export const serviceOwnerActions: QuickAction[] = [
  { label: 'New Request', icon: Plus, to: '/requests/new', variant: 'default' },
  { label: 'Track a Request', icon: Search, to: '/requests' },
  { label: 'Ask AI Assistant', icon: Sparkles },
];

export const opsLeadActions: QuickAction[] = [
  { label: 'Reassign', icon: UserCog },
  { label: 'Escalate', icon: ArrowUpCircle },
  { label: 'Send Reminder', icon: Send },
];
