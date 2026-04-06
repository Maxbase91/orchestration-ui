import { Breadcrumbs } from './breadcrumbs';
import { GlobalSearch } from './global-search';
import { NotificationBell } from './notification-bell';
import { RoleSwitcher } from './role-switcher';
import { Separator } from '@/components/ui/separator';

export function Topbar() {
  return (
    <header className="h-14 shrink-0 bg-white border-b border-border flex items-center justify-between px-4">
      <Breadcrumbs />
      <div className="flex items-center gap-2">
        <GlobalSearch />
        <Separator orientation="vertical" className="h-6 mx-1" />
        <NotificationBell />
        <Separator orientation="vertical" className="h-6 mx-1" />
        <RoleSwitcher />
      </div>
    </header>
  );
}
