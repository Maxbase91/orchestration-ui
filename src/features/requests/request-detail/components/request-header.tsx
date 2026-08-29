import type { ProcurementRequest } from '@/data/types';
import { StatusBadge } from '@/components/shared/status-badge';
import { PriorityIndicator } from '@/components/shared/priority-indicator';
import { SLACountdown } from '@/components/shared/sla-countdown';
import { ActionButtons } from './action-buttons';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface RequestHeaderProps {
  request: ProcurementRequest;
}

export function RequestHeader({ request }: RequestHeaderProps) {
  const navigate = useNavigate();

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
        </div>
        <ActionButtons request={request} />
      </div>
    </div>
  );
}
