import { statusColorMap, type StatusKey } from '@/config/theme';

export function getStatusColor(status: string): string {
  const key = status.toLowerCase() as StatusKey;
  return statusColorMap[key] ?? 'bg-gray-100 text-gray-700';
}

export function getStatusLabel(status: string): string {
  return status
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
};

export function getPriorityColor(priority: string): string {
  return priorityColors[priority.toLowerCase()] ?? 'bg-gray-100 text-gray-700';
}

const priorityIcons: Record<string, string> = {
  low: 'ArrowDown',
  medium: 'ArrowRight',
  high: 'ArrowUp',
  urgent: 'AlertTriangle',
};

export function getPriorityIcon(priority: string): string {
  return priorityIcons[priority.toLowerCase()] ?? 'Minus';
}
