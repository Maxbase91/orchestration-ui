import { SystemHealthPanel, RecentChangesLog, ConfigurationAlerts } from './components/system-health-panel';

export function AdminDashboard() {
  return (
    <div className="space-y-6">
      {/* System Health KPIs */}
      <SystemHealthPanel />

      <div className="grid grid-cols-3 gap-6">
        {/* Recent Changes - takes 2 cols */}
        <div className="col-span-2 bg-card rounded-md shadow-[0_1px_4px_rgba(0,0,0,0.08)] p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Changes</h2>
          <RecentChangesLog />
        </div>

        {/* Configuration Alerts */}
        <div className="bg-card rounded-md shadow-[0_1px_4px_rgba(0,0,0,0.08)] p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuration Alerts</h2>
          <ConfigurationAlerts />
        </div>
      </div>
    </div>
  );
}
