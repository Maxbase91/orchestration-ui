import type { ProcurementRequest } from '@/data/types';
import { StatusBadge } from '@/components/shared/status-badge';
import { PriorityIndicator } from '@/components/shared/priority-indicator';
import { SLACountdown } from '@/components/shared/sla-countdown';
import { ActionButtons } from './action-buttons';
import { ArrowLeft, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useWorkflowStepDetailsForRequest } from '@/lib/db/hooks/use-workflow-step-details';
import { useMemo } from 'react';
import { formatDate } from '@/lib/format';
import { getStatusLabel } from '@/lib/status';

interface RequestHeaderProps {
  request: ProcurementRequest;
}

export function RequestHeader({ request }: RequestHeaderProps) {
  const navigate = useNavigate();
  const { data: stepDetails = [] } = useWorkflowStepDetailsForRequest(request.id);

  // Flatten documentsAdded across all stages; pick the most recent.
  const latestDocument = useMemo(() => {
    const all: { name: string; type: string; addedAt: string; stage: string }[] = [];
    for (const d of stepDetails) {
      for (const doc of d.documentsAdded ?? []) {
        all.push({ name: doc.name, type: doc.type, addedAt: doc.addedAt, stage: d.stage });
      }
    }
    if (all.length === 0) return null;
    return all.sort((a, b) => b.addedAt.localeCompare(a.addedAt))[0];
  }, [stepDetails]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate('/requests')}>
          <ArrowLeft className="size-4" />
        </Button>
        <span className="text-sm text-muted-foreground">{request.id}</span>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold text-gray-900">{request.title}</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={request.status} />
            <PriorityIndicator priority={request.priority} showLabel />
            {request.slaDeadline && <SLACountdown deadline={request.slaDeadline} />}
            {request.isOverdue && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                Overdue
              </span>
            )}
            {request.referBackCount > 0 && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                Referred back {request.referBackCount}x
              </span>
            )}
          </div>
          {/* Latest-document chip: newest entry across all stage detail
              documentsAdded[]. Download is disabled pending document
              storage backend (Phase D of the earlier audit). */}
          {latestDocument && (
            <div className="mt-2 flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 w-fit">
              <FileText className="size-3.5 text-gray-500" />
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-gray-900 truncate max-w-[220px]">{latestDocument.name}</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-500">{latestDocument.type}</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-500">{getStatusLabel(latestDocument.stage)} stage</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-500">{formatDate(latestDocument.addedAt)}</span>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled
                title="Document download ships with the document-storage phase."
              >
                <Download className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
        <ActionButtons request={request} />
      </div>
    </div>
  );
}
