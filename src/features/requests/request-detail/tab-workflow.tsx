import { useState } from 'react';
import type { ProcurementRequest } from '@/data/types';
import { getStageHistoryByRequestId } from '@/data/stage-history';
import { getUserById } from '@/data/users';
import { formatDate } from '@/lib/format';
import { Timeline, type TimelineEvent } from '@/components/shared/timeline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw, UserPlus } from 'lucide-react';
import { ReferBackDialog } from './components/refer-back-dialog';
import { ReassignDialog } from './components/reassign-dialog';
import { LifecycleStepper } from './components/lifecycle-stepper';
import { getStatusLabel } from '@/lib/status';
import { getIntegrationsForRequest } from '@/data/system-integrations';
import { SystemIntegrationTimeline } from '@/components/shared/system-integration-timeline';

interface TabWorkflowProps {
  request: ProcurementRequest;
}

export function TabWorkflow({ request }: TabWorkflowProps) {
  const history = getStageHistoryByRequestId(request.id);
  const [referBackOpen, setReferBackOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);

  const owner = getUserById(request.ownerId);
  const integrations = getIntegrationsForRequest(request.id);

  const events: TimelineEvent[] = history.map((entry, index) => {
    const user = getUserById(entry.ownerId);
    const actionLabel = entry.action
      ? getStatusLabel(entry.action)
      : `Entered ${getStatusLabel(entry.stage)}`;
    const durationMs = entry.completedAt
      ? new Date(entry.completedAt).getTime() - new Date(entry.enteredAt).getTime()
      : null;
    const durationDays = durationMs ? Math.round(durationMs / (1000 * 60 * 60 * 24)) : null;
    const detail = [
      entry.notes,
      durationDays !== null ? `Duration: ${durationDays} day(s)` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    let type: TimelineEvent['type'] = 'human';
    if (entry.action === 'referred-back') type = 'warning';
    if (!entry.completedAt && entry.stage === request.status) type = 'system';

    return {
      id: `${entry.requestId}-${entry.stage}-${index}`,
      timestamp: formatDate(entry.enteredAt),
      actor: user?.name ?? 'Unknown',
      action: `${actionLabel} - ${getStatusLabel(entry.stage)}`,
      detail: detail || undefined,
      type,
    };
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current Workflow Position</CardTitle>
        </CardHeader>
        <CardContent>
          <LifecycleStepper request={request} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Action History</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline events={events} />
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current Action Owner</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm font-medium text-gray-900">{owner?.name ?? 'Unassigned'}</p>
              <p className="text-sm text-muted-foreground">{owner?.role}</p>
              <p className="text-sm text-muted-foreground">{request.daysInStage} day(s) held</p>
            </CardContent>
          </Card>
          <div className="flex flex-col gap-2">
            <Button variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-50" onClick={() => setReferBackOpen(true)}>
              <RotateCcw className="size-3.5" />
              Refer Back
            </Button>
            <Button variant="outline" onClick={() => setReassignOpen(true)}>
              <UserPlus className="size-3.5" />
              Reassign
            </Button>
          </div>
        </div>
      </div>

      {integrations.length > 0 && (
        <div className="bg-card rounded-md shadow-[0_1px_4px_rgba(0,0,0,0.08)] p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">System Integrations</h3>
          <SystemIntegrationTimeline integrations={integrations} />
        </div>
      )}

      <ReferBackDialog open={referBackOpen} onOpenChange={setReferBackOpen} request={request} />
      <ReassignDialog open={reassignOpen} onOpenChange={setReassignOpen} />
    </div>
  );
}
