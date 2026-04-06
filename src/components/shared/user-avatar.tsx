import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface UserAvatarProps {
  name: string;
  initials: string;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
}

const sizeMap = {
  sm: 'sm' as const,
  md: 'default' as const,
  lg: 'lg' as const,
};

export function UserAvatar({ name, initials, size = 'md', showName = false }: UserAvatarProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <Avatar size={sizeMap[size]}>
        <AvatarFallback
          className={cn(
            'bg-[#1B2A4A] text-white font-medium',
            size === 'sm' && 'text-[10px]',
            size === 'md' && 'text-xs',
            size === 'lg' && 'text-sm'
          )}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
      {showName && <span className="text-sm text-gray-900">{name}</span>}
    </span>
  );
}
