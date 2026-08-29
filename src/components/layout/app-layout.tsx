import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { RouteErrorBoundary } from './route-error-boundary';

export function AppLayout() {
  const { currentRole } = useAuthStore();

  if (currentRole === 'supplier') {
    return <Navigate to="/portal" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
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
