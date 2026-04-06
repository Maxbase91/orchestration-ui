import { cn } from '@/lib/utils';
import { differenceInDays, differenceInHours, parseISO } from 'date-fns';

interface SLACountdownProps {
  deadline: string;
  compact?: boolean;
}

export function SLACountdown({ deadline, compact = false }: SLACountdownProps) {
  const now = new Date();
  const deadlineDate = parseISO(deadline);
  const daysLeft = differenceInDays(deadlineDate, now);
  const hoursLeft = differenceInHours(deadlineDate, now);

  const isOverdue = daysLeft < 0;
  const isUrgent = daysLeft >= 0 && daysLeft <= 3;

  const colorClass = isOverdue
    ? 'text-red-600'
    : isUrgent
      ? 'text-amber-600'
      : 'text-green-600';

  let label: string;
  if (isOverdue) {
    const overdueDays = Math.abs(daysLeft);
    label = compact
      ? `${overdueDays}d overdue`
      : `${overdueDays} day${overdueDays !== 1 ? 's' : ''} overdue`;
  } else if (daysLeft === 0) {
    label = compact ? `${hoursLeft}h left` : `${hoursLeft} hours left`;
  } else {
    label = compact
      ? `${daysLeft}d left`
      : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;
  }

  return (
    <span className={cn('text-sm font-medium', colorClass)}>
      {label}
    </span>
  );
}
