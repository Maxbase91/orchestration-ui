import { useMemo } from 'react';
import { CheckCircle, ClipboardList } from 'lucide-react';
import { requests } from '@/data/requests';
import { formatCurrency, formatRelativeTime } from '@/lib/format';
import { StatusBadge } from '@/components/shared/status-badge';
import { KPICard } from '@/components/shared/kpi-card';
import { AISuggestionCard } from '@/components/shared/ai-suggestion-card';
import { ValidationQueueCard } from './components/validation-queue-card';

const completedLikeStatuses = new Set([
  'approval', 'sourcing', 'contracting', 'po', 'receipt', 'invoice', 'payment', 'completed',
]);

export function VendorManagerDashboard() {
  const validationQueue = useMemo(() => {
    return requests.filter((r) => r.status === 'validation');
  }, []);

  const recentlyValidated = useMemo(() => {
    return requests
      .filter((r) => completedLikeStatuses.has(r.status))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 10);
  }, []);

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          label="Validation Queue"
          value={validationQueue.length}
          trend={{ direction: 'up', percentage: 10 }}
        />
        <KPICard
          label="Today's Reviews"
          value={2}
          trend={{ direction: 'flat', percentage: 0 }}
        />
        <KPICard
          label="Avg Validation Time"
          value="3.2d"
          trend={{ direction: 'down', percentage: 15 }}
        />
        <KPICard
          label="First-Time Right Rate"
          value={85}
          format="percentage"
          trend={{ direction: 'up', percentage: 4 }}
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Validation Queue - Primary */}
        <div className="col-span-2 space-y-6">
          <div className="bg-card rounded-md shadow-[0_1px_4px_rgba(0,0,0,0.08)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Validation Queue</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                <ClipboardList className="size-3.5" />
                {validationQueue.length} pending
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {validationQueue.map((r) => (
                <ValidationQueueCard key={r.id} request={r} />
              ))}
            </div>
            {validationQueue.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <CheckCircle className="size-10 mb-2" />
                <p className="text-sm font-medium">Queue is clear</p>
                <p className="text-xs">No requests pending validation.</p>
              </div>
            )}
          </div>

          {/* AI Pre-Validation Summary */}
          <AISuggestionCard
            title="Pre-Validation Summary"
            confidence={92}
            showExplanation
            explanation="AI analysis based on historical validation patterns, buying channel rules, commodity code mappings, and supplier SRA status."
          >
            <ul className="space-y-2 list-none">
              <li className="flex items-start gap-2">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-green-400" />
                <span>{validationQueue.filter((r) => r.buyingChannel === 'procurement-led' || r.buyingChannel === 'framework-call-off').length} requests have correct buying channel classification.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-amber-400" />
                <span>{validationQueue.filter((r) => r.buyingChannel === 'business-led' || r.buyingChannel === 'direct-po').length} requests may need buying channel reclassification.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-red-400" />
                <span>{validationQueue.filter((r) => !r.supplierId).length} requests have no supplier linked.</span>
              </li>
            </ul>
          </AISuggestionCard>
        </div>

        {/* Right Column - Recently Validated */}
        <div className="bg-card rounded-md shadow-[0_1px_4px_rgba(0,0,0,0.08)] p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recently Validated</h2>
          <div className="space-y-2">
            {recentlyValidated.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 rounded border border-gray-100 p-2.5 hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-400">{r.id}</span>
                    <StatusBadge status={r.status} size="sm" />
                  </div>
                  <p className="mt-0.5 text-sm text-gray-900 truncate">{r.title}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{formatRelativeTime(r.updatedAt)}</p>
                </div>
                <p className="text-xs font-medium text-gray-600 shrink-0">{formatCurrency(r.value, r.currency)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
