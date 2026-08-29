import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { RouteErrorBoundary } from './route-error-boundary';

export function AppLayout() {
  const { currentRole } = useAuthStore();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (currentRole === 'supplier') {
    return <Navigate to="/portal" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onMenuClick={() => setMobileNavOpen(true)} />
        {mobileNavOpen && (
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-40 bg-black/30 md:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
        )}
        {/* pb-24: the floating AI assistant button is fixed bottom-6 right-6
            (an 80px-tall zone in the viewport's bottom-right, independent of
            scroll). Without this, a page's own bottom-right content — e.g. the
            wizard's Next button — can scroll directly under it and become
            unclickable. Extra bottom padding keeps scrollable content clear. */}
        <main className="flex-1 overflow-auto p-6 pb-24">
          <RouteErrorBoundary>
            <Outlet />
          </RouteErrorBoundary>
        </main>
      </div>
    </div>
  );
}
