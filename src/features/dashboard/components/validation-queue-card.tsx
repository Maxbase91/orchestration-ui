import { useNavigate } from 'react-router-dom';
import { CheckCircle, AlertTriangle, FileSearch } from 'lucide-react';
import type { ProcurementRequest } from '@/data/types';
import { getUserById } from '@/data/users';
import { formatCurrency } from '@/lib/format';
import { StatusBadge } from '@/components/shared/status-badge';
import { getStatusLabel } from '@/lib/status';
import { Button } from '@/components/ui/button';

interface ValidationQueueCardProps {
  request: ProcurementRequest;
}

function getAiAssessment(request: ProcurementRequest): { label: string; ok: boolean }[] {
  const assessments: { label: string; ok: boolean }[] = [];

  // DEUBA check
  if (request.deuba === 'gp-led' || request.deuba === 'framework-call-off') {
    assessments.push({ label: 'DEUBA appears correct', ok: true });
  } else {
    assessments.push({ label: 'DEUBA classification may need review', ok: false });
  }

  // Commodity code check
  if (request.commodityCode && request.commodityCodeLabel) {
    assessments.push({ label: `Commodity code ${request.commodityCode} matches "${request.commodityCodeLabel}"`, ok: true });
  }

  // TPRA check based on supplier
  if (request.supplierId) {
    assessments.push({ label: 'Supplier linked', ok: true });
  } else {
    assessments.push({ label: 'No supplier linked — requires review', ok: false });
  }

  // Value threshold check
  if (request.value > 500000) {
    assessments.push({ label: 'High-value request — VP approval required', ok: false });
  }

  return assessments;
}

export function ValidationQueueCard({ request }: ValidationQueueCardProps) {
  const navigate = useNavigate();
  const requestor = getUserById(request.requestorId);
  const assessments = getAiAssessment(request);

  return (
    <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm cursor-pointer hover:border-gray-300 transition-colors" onClick={() => navigate(`/requests/${request.id}`)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-gray-400">{request.id}</span>
            <StatusBadge status={request.status} size="sm" />
          </div>
          <p className="mt-1 text-sm font-semibold text-gray-900">{request.title}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-gray-900">{formatCurrency(request.value, request.currency)}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
        <div>
          <span className="text-gray-400">DEUBA:</span>{' '}
          <span className="font-medium">{getStatusLabel(request.deuba)}</span>
        </div>
        <div>
          <span className="text-gray-400">Commodity:</span>{' '}
          <span className="font-medium">{request.commodityCode}</span>
        </div>
        <div>
          <span className="text-gray-400">Requestor:</span>{' '}
          <span className="font-medium">{requestor?.name ?? request.requestorId}</span>
        </div>
        <div>
          <span className="text-gray-400">Days in stage:</span>{' '}
          <span className="font-medium">{request.daysInStage}d</span>
        </div>
      </div>

      {/* AI Pre-Validation */}
      <div className="mt-3 rounded border border-blue-100 bg-blue-50/50 p-2.5">
        <p className="text-xs font-medium text-blue-600 mb-1.5">AI Pre-Validation</p>
        <div className="space-y-1">
          {assessments.map((a, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              {a.ok ? (
                <CheckCircle className="size-3.5 text-green-500 shrink-0" />
              ) : (
                <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
              )}
              <span className={a.ok ? 'text-gray-600' : 'text-amber-700 font-medium'}>{a.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant="default" className="flex-1">
          <CheckCircle className="size-3.5" />
          Validate
        </Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={() => navigate(`/requests/${request.id}`)}>
          <FileSearch className="size-3.5" />
          Review
        </Button>
      </div>
    </div>
  );
}
