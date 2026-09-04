import { Breadcrumbs } from './breadcrumbs';
import { GlobalSearch } from './global-search';
import { NotificationBell } from './notification-bell';
import { RoleSwitcher } from './role-switcher';
import { Separator } from '@/components/ui/separator';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  return (
    <header className="h-14 shrink-0 bg-white border-b border-border flex items-center justify-between px-4">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          aria-label="Open navigation"
          onClick={onMenuClick}
        >
          <Menu className="size-4" />
        </Button>
        <Breadcrumbs />
      </div>
      <div className="flex items-center gap-2">
        <GlobalSearch />
        <Separator orientation="vertical" className="h-6 mx-1" />
        <NotificationBell />
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Separator orientation="vertical" className="h-6 mx-1" />
        <RoleSwitcher />
      </div>
    </header>
  );
}
