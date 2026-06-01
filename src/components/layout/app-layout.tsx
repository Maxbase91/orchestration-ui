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
        <main className="flex-1 overflow-auto p-6">
          <RouteErrorBoundary>
            <Outlet />
          </RouteErrorBoundary>
        </main>
      </div>
    </div>
  );
}
