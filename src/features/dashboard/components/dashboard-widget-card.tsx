import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardWidgetCardProps {
  id: string;
  title: string;
  size: string;
  onRemove: () => void;
  children: ReactNode;
}

const sizeClasses: Record<string, string> = {
  small: 'col-span-1',
  medium: 'col-span-2',
  large: 'col-span-2',
  full: 'col-span-3',
};

export function DashboardWidgetCard({ id, title, size, onRemove, children }: DashboardWidgetCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        'group bg-card rounded-md shadow-[0_1px_4px_rgba(0,0,0,0.08)] p-4',
        sizeClasses[size] ?? 'col-span-1',
        isDragging && 'opacity-50 ring-2 ring-blue-200',
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
      {children}
    </div>
  );
}
