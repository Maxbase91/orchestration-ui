// The top of a request: where it is, what it is, and what can be done with it.
//
// The actions used to share a row with the title, so a two-line title and a
// seven-button toolbar squeezed each other into two rows apiece. The ID and the
// actions now share the first line — both are short — and the title gets the
// page's full width beneath them.
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
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon-sm" aria-label="Back to requests" onClick={() => navigate('/requests')}>
            <ArrowLeft className="size-4" />
          </Button>
          <span className="font-mono text-caption text-ink-3">{request.id}</span>
        </div>
        <ActionButtons request={request} />
      </div>
      <h1 className="text-balance text-heading font-semibold text-ink">{request.title}</h1>
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={request.status} />
        <PriorityIndicator priority={request.priority} showLabel />
        {request.slaDeadline && <SLACountdown deadline={request.slaDeadline} />}
        {request.isOverdue && (
          <span className="rounded-full bg-stop-soft px-2.5 py-0.5 text-caption font-medium text-stop">
            Overdue
          </span>
        )}
        {request.referBackCount > 0 && (
          <span className="rounded-full bg-warn-soft px-2.5 py-0.5 text-caption font-medium text-warn">
            Referred back {request.referBackCount}×
          </span>
        )}
      </div>
    </div>
  );
}
