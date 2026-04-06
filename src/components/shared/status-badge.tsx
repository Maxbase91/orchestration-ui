import { cn } from '@/lib/utils';
import { getStatusColor, getStatusLabel } from '@/lib/status';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const colorClasses = getStatusColor(status);
  const label = getStatusLabel(status);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        colorClasses,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      )}
    >
      {label}
    </span>
  );
}
