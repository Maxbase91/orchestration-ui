import { cn } from '@/lib/utils';

interface AIConfidenceBadgeProps {
  confidence: number;
}

function getConfidenceLevel(confidence: number) {
  if (confidence < 40) return { label: 'Low', color: 'bg-red-100 text-red-700' };
  if (confidence <= 70) return { label: 'Medium', color: 'bg-amber-100 text-amber-700' };
  return { label: 'High', color: 'bg-green-100 text-green-700' };
}

export function AIConfidenceBadge({ confidence }: AIConfidenceBadgeProps) {
  const { label, color } = getConfidenceLevel(confidence);

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', color)}>
      {confidence}% {label}
    </span>
  );
}
