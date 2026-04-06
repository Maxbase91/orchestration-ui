import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CategoryTileProps {
  icon: LucideIcon;
  name: string;
  description: string;
  timeline: string;
  selected: boolean;
  onClick: () => void;
}

export function CategoryTile({
  icon: Icon,
  name,
  description,
  timeline,
  selected,
  onClick,
}: CategoryTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-all hover:border-blue-300 hover:bg-blue-50/50',
        selected
          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
          : 'border-gray-200 bg-white'
      )}
    >
      <div
        className={cn(
          'flex size-10 items-center justify-center rounded-lg',
          selected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
        )}
      >
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-900">{name}</p>
        <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{description}</p>
      </div>
      <span className="mt-auto inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
        {timeline}
      </span>
    </button>
  );
}
