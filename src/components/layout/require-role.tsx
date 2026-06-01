import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import type { Role } from '@/config/roles';

interface RequireRoleProps {
  roles: Role[];
}

export function RequireRole({ roles }: RequireRoleProps) {
  const { currentRole } = useAuthStore();
  if (!roles.includes(currentRole)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
