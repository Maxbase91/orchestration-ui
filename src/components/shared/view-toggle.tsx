import { cn } from '@/lib/utils';
import {
  LayoutGrid,
  Table,
  Clock,
  List,
  Kanban,
  Map,
  type LucideIcon,
} from 'lucide-react';

interface ViewToggleProps {
  views: { id: string; label: string; icon: string }[];
  activeView: string;
  onChange: (view: string) => void;
}

const iconMap: Record<string, LucideIcon> = {
  grid: LayoutGrid,
  table: Table,
  timeline: Clock,
  list: List,
  kanban: Kanban,
  map: Map,
};

export function ViewToggle({ views, activeView, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex items-center rounded-md border bg-white p-0.5">
      {views.map((view) => {
        const Icon = iconMap[view.icon] ?? List;
        const isActive = view.id === activeView;

        return (
          <button
            key={view.id}
            type="button"
            onClick={() => onChange(view.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors',
              isActive
                ? 'bg-[#1B2A4A] text-white'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title={view.label}
          >
            <Icon className="size-3.5" />
            <span className="hidden sm:inline">{view.label}</span>
          </button>
        );
      })}
    </div>
  );
}
