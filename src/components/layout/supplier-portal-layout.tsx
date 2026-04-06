import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Building2,
  ClipboardList,
  Search,
  Receipt,
  FolderOpen,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { RoleSwitcher } from './role-switcher';
import { NotificationBell } from './notification-bell';

const portalNavItems = [
  { label: 'Dashboard', icon: Home, path: '/portal' },
  { label: 'Profile', icon: Building2, path: '/portal/profile' },
  { label: 'Onboarding', icon: ClipboardList, path: '/portal/onboarding' },
  { label: 'Sourcing', icon: Search, path: '/portal/sourcing' },
  { label: 'Invoices', icon: Receipt, path: '/portal/invoices' },
  { label: 'Documents', icon: FolderOpen, path: '/portal/documents' },
  { label: 'Messages', icon: MessageSquare, path: '/portal/messages' },
];

export function SupplierPortalLayout() {
  const { currentRole } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  if (currentRole !== 'supplier') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface">
      {/* Top bar */}
      <header className="h-14 shrink-0 bg-white border-b border-border flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500 shrink-0">
            <span className="text-sm font-bold text-white">GP</span>
          </div>
          <span className="text-sm font-semibold text-navy-800 tracking-tight">
            Supplier Portal
          </span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <RoleSwitcher />
        </div>
      </header>

      {/* Horizontal nav */}
      <nav className="shrink-0 bg-white border-b border-border px-6">
        <div className="flex items-center gap-1 -mb-px">
          {portalNavItems.map((item) => {
            const isActive =
              item.path === '/portal'
                ? location.pathname === '/portal'
                : location.pathname.startsWith(item.path);
            const Icon = item.icon;

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex items-center gap-2 px-3 py-3 text-sm font-medium border-b-2 transition-colors',
                  isActive
                    ? 'border-amber-500 text-navy-800'
                    : 'border-transparent text-text-muted hover:text-text-primary hover:border-border',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
