import { cn } from '@/lib/utils';

interface AIConfidenceBadgeProps {
  confidence: number;
}

// Accept both 0-1 fractions (e.g. 0.92) and 0-100 integers (e.g. 92).
function normalizeConfidence(c: number): number {
  return c <= 1 ? Math.round(c * 100) : Math.round(c);
}

function getConfidenceLevel(pct: number) {
  if (pct < 40) return { label: 'Low', color: 'bg-red-100 text-red-700' };
  if (pct <= 70) return { label: 'Medium', color: 'bg-amber-100 text-amber-700' };
  return { label: 'High', color: 'bg-green-100 text-green-700' };
}

export function AIConfidenceBadge({ confidence }: AIConfidenceBadgeProps) {
  const pct = normalizeConfidence(confidence);
  const { label, color } = getConfidenceLevel(pct);

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', color)}>
      {pct}% {label}
    </span>
  );
}
