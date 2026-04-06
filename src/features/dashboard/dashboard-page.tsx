import { useAuthStore } from '@/stores/auth-store';
import { ServiceOwnerDashboard } from './service-owner-dashboard';
import { ProcurementManagerDashboard } from './procurement-manager-dashboard';
import { VendorManagerDashboard } from './vendor-manager-dashboard';
import { OperationsLeadDashboard } from './operations-lead-dashboard';
import { AdminDashboard } from './admin-dashboard';

const titles: Record<string, string> = {
  'service-owner': 'My Dashboard',
  'procurement-manager': 'Procurement Dashboard',
  'vendor-manager': 'Validation Dashboard',
  'operations-lead': 'Operations Dashboard',
  'admin': 'Admin Dashboard',
  'supplier': 'Supplier Dashboard',
};

export function DashboardPage() {
  const currentRole = useAuthStore((s) => s.currentRole);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-text-primary mb-6">
        {titles[currentRole] ?? 'Dashboard'}
      </h1>

      {currentRole === 'service-owner' && <ServiceOwnerDashboard />}
      {currentRole === 'procurement-manager' && <ProcurementManagerDashboard />}
      {currentRole === 'vendor-manager' && <VendorManagerDashboard />}
      {currentRole === 'operations-lead' && <OperationsLeadDashboard />}
      {currentRole === 'admin' && <AdminDashboard />}
      {currentRole === 'supplier' && (
        <div className="bg-card rounded-md shadow-[0_1px_4px_rgba(0,0,0,0.08)] p-6">
          <p className="text-text-secondary">Supplier portal dashboard coming soon.</p>
        </div>
      )}
    </div>
  );
}
