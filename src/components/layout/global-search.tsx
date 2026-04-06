import { useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export function GlobalSearch() {
  const [focused, setFocused] = useState(false);

  return (
    <div
      className={cn(
        'relative flex items-center transition-all duration-200',
        focused ? 'w-[280px]' : 'w-[240px]',
      )}
    >
      <Search className="absolute left-2.5 h-4 w-4 text-text-muted pointer-events-none" />
      <input
        type="text"
        placeholder="Search requests, suppliers, contracts..."
        className={cn(
          'w-full h-8 pl-8 pr-3 text-sm rounded-md border border-input bg-white',
          'placeholder:text-text-muted text-text-primary',
          'focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring',
          'transition-all duration-200',
        )}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </div>
  );
}
