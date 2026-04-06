import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { requests } from '@/data/requests';
import { notifications } from '@/data/notifications';
import { formatCurrency, formatRelativeTime } from '@/lib/format';
import { StatusBadge } from '@/components/shared/status-badge';
import { AISuggestionCard } from '@/components/shared/ai-suggestion-card';
import { RecentActivityFeed } from './components/recent-activity-feed';
import { QuickActions, serviceOwnerActions } from './components/quick-actions';

const activeStatuses = new Set([
  'draft', 'intake', 'validation', 'approval', 'sourcing', 'contracting', 'po', 'receipt', 'invoice', 'referred-back',
]);

export function ServiceOwnerDashboard() {
  const { currentUser } = useAuthStore();
  const navigate = useNavigate();

  const myRequests = useMemo(() => {
    return requests
      .filter((r) => r.requestorId === currentUser.id || activeStatuses.has(r.status))
      .slice(0, 8);
  }, [currentUser.id]);

  const actionsRequired = useMemo(() => {
    return requests.filter(
      (r) => r.status === 'referred-back' || (r.status === 'approval' && r.isOverdue)
    ).length;
  }, []);

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="bg-card rounded-md shadow-[0_1px_4px_rgba(0,0,0,0.08)] p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Quick Actions</h2>
        <QuickActions actions={serviceOwnerActions} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* My Active Requests */}
        <div className="col-span-2 bg-card rounded-md shadow-[0_1px_4px_rgba(0,0,0,0.08)] p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">My Active Requests</h2>
            {actionsRequired > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                <AlertCircle className="size-3.5" />
                {actionsRequired} actions required
              </span>
            )}
          </div>

          <div className="space-y-2">
            {myRequests.map((r) => (
              <button
                key={r.id}
                onClick={() => navigate(`/requests/${r.id}`)}
                className="w-full flex items-center justify-between gap-4 rounded border border-gray-100 bg-white p-3 hover:bg-gray-50 transition-colors cursor-pointer text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-gray-400">{r.id}</span>
                    <StatusBadge status={r.status} size="sm" />
                  </div>
                  <p className="mt-1 text-sm font-medium text-gray-900 truncate">{r.title}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(r.value, r.currency)}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{formatRelativeTime(r.updatedAt)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Recent Activity */}
          <div className="bg-card rounded-md shadow-[0_1px_4px_rgba(0,0,0,0.08)] p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
            <RecentActivityFeed notifications={notifications} limit={5} />
          </div>

          {/* AI Suggestion */}
          <AISuggestionCard
            title="Contract Renewals Upcoming"
            confidence={88}
            showExplanation
            explanation="Analysis of contract end dates within your department shows 3 contracts expiring between now and March 2025."
          >
            <p>
              You have 3 contracts renewing in the next 60 days. Would you like to start renewal requests?
            </p>
          </AISuggestionCard>
        </div>
      </div>
    </div>
  );
}
