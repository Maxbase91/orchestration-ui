// Time-to-deadline label for SLA tracking. Computed at render time — no ticking
// timer, a re-render is enough at day-level granularity.
//
// Colour is the SECOND signal, never the only one: the label itself says
// "overdue" or "left", so the state survives greyscale, a colour-blind reader
// and a screen reader. The tokens carry the hue.
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
    ? 'text-stop'
    : isUrgent
      ? 'text-warn'
      : 'text-ok';

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
    // Tabular figures so a column of countdowns lines up rather than shifting
    // with each digit width.
    <span className={cn('text-body font-medium tabular-nums', colorClass)}>
      {label}
    </span>
  );
}
