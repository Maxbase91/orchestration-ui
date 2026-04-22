import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, AlertTriangle, MessageCircleQuestion } from 'lucide-react';
import { requests } from '@/data/requests';
import { useUserLookup, useUsers } from '@/lib/db/hooks/use-users';
import { formatRelativeTime } from '@/lib/format';
import { StatusBadge } from '@/components/shared/status-badge';
import { WorkflowHealthCards } from './components/workflow-health-cards';
import { QuickActions, opsLeadActions } from './components/quick-actions';

const activeStatuses = new Set([
  'intake', 'validation', 'approval', 'sourcing', 'contracting', 'po', 'receipt', 'invoice', 'referred-back',
]);

interface UnresolvedQuery {
  id: string;
  requestId: string;
  question: string;
  askedBy: string;
  askedAt: string;
}

const unresolvedQueries: UnresolvedQuery[] = [
  { id: 'Q1', requestId: 'REQ-2024-0009', question: 'Can you provide the updated business case with ROI projections for Year 2-3?', askedBy: 'Dr. Katrin Bauer', askedAt: '2025-01-06T10:00:00Z' },
  { id: 'Q2', requestId: 'REQ-2024-0012', question: 'Safety review flagged racking load capacity. Please confirm revised specifications.', askedBy: 'Anna Muller', askedAt: '2025-01-07T14:00:00Z' },
  { id: 'Q3', requestId: 'REQ-2024-0008', question: 'Is Konica Minolta SRA renewal in progress? Status needed before validation can proceed.', askedBy: 'Anna Kowalski', askedAt: '2025-01-05T09:00:00Z' },
];

export function OperationsLeadDashboard() {
  const navigate = useNavigate();
  useUsers();
  const lookupUser = useUserLookup();
  const bottleneckData = useMemo(() => {
    return requests
      .filter((r) => activeStatuses.has(r.status))
      .sort((a, b) => b.daysInStage - a.daysInStage);
  }, []);

  const slaAtRisk = useMemo(() => {
    return requests.filter((r) => {
      if (!activeStatuses.has(r.status)) return false;
      return r.isOverdue || r.daysInStage > 20;
    }).sort((a, b) => b.daysInStage - a.daysInStage);
  }, []);

  return (
    <div className="space-y-6">
      {/* Workflow Health KPIs */}
      <WorkflowHealthCards />

      {/* Quick Actions */}
      <div className="bg-card rounded-md shadow-[0_1px_4px_rgba(0,0,0,0.08)] p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Quick Actions</h2>
        <QuickActions actions={opsLeadActions} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Bottleneck Table */}
        <div className="col-span-2 bg-card rounded-md shadow-[0_1px_4px_rgba(0,0,0,0.08)] p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Bottleneck Analysis</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="pb-2 pr-3">ID</th>
                  <th className="pb-2 pr-3">Title</th>
                  <th className="pb-2 pr-3">Stage</th>
                  <th className="pb-2 pr-3">Owner</th>
                  <th className="pb-2 pr-3 text-right">Days</th>
                  <th className="pb-2 pr-3">SLA</th>
                  <th className="pb-2">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {bottleneckData.slice(0, 12).map((r) => {
                  const owner = lookupUser(r.ownerId);
                  const slaStatus = r.isOverdue
                    ? 'Breached'
                    : r.daysInStage > 20
                      ? 'At Risk'
                      : 'On Track';
                  const slaColor = r.isOverdue
                    ? 'text-red-600 bg-red-50'
                    : r.daysInStage > 20
                      ? 'text-amber-600 bg-amber-50'
                      : 'text-green-600 bg-green-50';

                  return (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/requests/${r.id}`)}>
                      <td className="py-2.5 pr-3 font-mono text-xs text-gray-400">{r.id}</td>
                      <td className="py-2.5 pr-3 max-w-[200px] truncate font-medium text-gray-900">{r.title}</td>
                      <td className="py-2.5 pr-3"><StatusBadge status={r.status} size="sm" /></td>
                      <td className="py-2.5 pr-3 text-gray-600">{owner?.name ?? '-'}</td>
                      <td className="py-2.5 pr-3 text-right font-medium text-gray-900">{r.daysInStage}</td>
                      <td className="py-2.5 pr-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${slaColor}`}>
                          {slaStatus}
                        </span>
                      </td>
                      <td className="py-2.5 text-xs text-gray-400">{formatRelativeTime(r.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* SLA Tracker */}
          <div className="bg-card rounded-md shadow-[0_1px_4px_rgba(0,0,0,0.08)] p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">SLA Tracker</h2>
            <div className="space-y-2">
              {slaAtRisk.slice(0, 5).map((r) => (
                <button key={r.id} onClick={() => navigate(`/requests/${r.id}`)} className="w-full flex items-center gap-3 rounded border border-gray-100 p-2.5 hover:bg-gray-50 transition-colors cursor-pointer text-left">
                  <div className={`flex size-7 shrink-0 items-center justify-center rounded-full ${r.isOverdue ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
                    {r.isOverdue ? <AlertTriangle className="size-3.5" /> : <Clock className="size-3.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-mono text-gray-400">{r.id}</p>
                    <p className="text-sm text-gray-900 truncate">{r.title}</p>
                  </div>
                  <span className={`text-xs font-bold ${r.isOverdue ? 'text-red-600' : 'text-amber-600'}`}>
                    {r.daysInStage}d
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Unresolved Queries */}
          <div className="bg-card rounded-md shadow-[0_1px_4px_rgba(0,0,0,0.08)] p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Unresolved Queries</h2>
            <div className="space-y-2">
              {unresolvedQueries.map((q) => (
                <button key={q.id} onClick={() => navigate(`/requests/${q.requestId}`)} className="w-full rounded border border-gray-100 p-3 hover:bg-gray-50 transition-colors cursor-pointer text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageCircleQuestion className="size-3.5 text-blue-500" />
                    <span className="text-xs font-mono text-gray-400">{q.requestId}</span>
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-2">{q.question}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                    <span>{q.askedBy}</span>
                    <span>&middot;</span>
                    <span>{formatRelativeTime(q.askedAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
