import {
  Inbox,
  Search,
  FileText,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

const iconMap: Record<string, LucideIcon> = {
  inbox: Inbox,
  search: Search,
  file: FileText,
  alert: AlertCircle,
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const Icon = icon ? (iconMap[icon] ?? Inbox) : Inbox;

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-gray-100">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <h3 className="mt-3 text-sm font-medium text-gray-900">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && (
        <Button variant="default" size="sm" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
