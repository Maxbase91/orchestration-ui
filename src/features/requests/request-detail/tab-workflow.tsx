import { useState, useRef, useCallback, useMemo } from 'react';
import type { ProcurementRequest, RequestStatus, StageHistoryEntry } from '@/data/types';
import { getStageHistoryByRequestId } from '@/data/stage-history';
import { getUserById } from '@/data/users';
import { getIntegrationsForRequest } from '@/data/system-integrations';
import { getStepDetailsForRequest } from '@/data/workflow-step-details';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw, UserPlus } from 'lucide-react';
import { ReferBackDialog } from './components/refer-back-dialog';
import { ReassignDialog } from './components/reassign-dialog';
import { ProcessStepper } from '@/components/shared/process-stepper';
import type { Step } from '@/components/shared/process-stepper';
import { StepDetailCard } from './components/step-detail-card';
import { SystemIntegrationTimeline } from '@/components/shared/system-integration-timeline';
import { formatDate } from '@/lib/format';
import { systemLabels, systemColors } from '@/data/system-integrations';

interface TabWorkflowProps {
  request: ProcurementRequest;
}

const LIFECYCLE_STAGES: { id: RequestStatus; label: string }[] = [
  { id: 'intake', label: 'Intake' },
  { id: 'validation', label: 'Validation' },
  { id: 'approval', label: 'Approval' },
  { id: 'sourcing', label: 'Sourcing' },
  { id: 'contracting', label: 'Contracting' },
  { id: 'po', label: 'Purchase Order' },
  { id: 'receipt', label: 'Goods Receipt' },
  { id: 'invoice', label: 'Invoice' },
  { id: 'payment', label: 'Payment' },
];

function getDaysInStep(entry: StageHistoryEntry): number | undefined {
  if (!entry.completedAt) return undefined;
  const start = new Date(entry.enteredAt).getTime();
  const end = new Date(entry.completedAt).getTime();
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

export function TabWorkflow({ request }: TabWorkflowProps) {
  const history = getStageHistoryByRequestId(request.id);
  const stepDetails = getStepDetailsForRequest(request.id);
  const integrations = getIntegrationsForRequest(request.id);
  const owner = getUserById(request.ownerId);

  const [referBackOpen, setReferBackOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(() => {
    // Default: expand the current stage
    const initial = new Set<string>();
    if (
      request.status !== 'completed' &&
      request.status !== 'cancelled' &&
      request.status !== 'draft'
    ) {
      initial.add(request.status);
    }
    return initial;
  });
  const [highlightedStage, setHighlightedStage] = useState<string | null>(null);

  // Refs for scrolling
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Build stage data
  const completedStages = new Set<string>();
  const stageEntries = new Map<string, StageHistoryEntry>();

  for (const entry of history) {
    if (entry.stage === 'draft' || entry.stage === 'referred-back' || entry.stage === 'completed')
      continue;
    if (entry.completedAt) {
      completedStages.add(entry.stage);
    }
    stageEntries.set(entry.stage, entry);
  }

  const isCancelled = request.status === 'cancelled';
  const isCompleted = request.status === 'completed';

  // Build stepper steps
  const steps: Step[] = useMemo(() => {
    return LIFECYCLE_STAGES.map((stage) => {
      const entry = stageEntries.get(stage.id);
      const isStageCompleted = completedStages.has(stage.id);
      const isCurrent = request.status === stage.id;

      let status: Step['status'];
      if (isCancelled) {
        status = isStageCompleted ? 'completed' : 'skipped';
      } else if (isCompleted) {
        status = 'completed';
      } else if (isCurrent) {
        status = request.isOverdue ? 'blocked' : 'current';
      } else if (request.status === 'referred-back' && entry && !entry.completedAt) {
        status = 'blocked';
      } else if (isStageCompleted) {
        status = 'completed';
      } else {
        status = 'future';
      }

      const stageOwner = entry ? getUserById(entry.ownerId) : undefined;
      const daysInStep = entry ? getDaysInStep(entry) : undefined;

      const step: Step = {
        id: stage.id,
        label: stage.label,
        status,
        date: entry ? formatDate(entry.enteredAt) : undefined,
        owner: stageOwner?.name,
        daysInStep,
      };

      // Attach system integration info
      const matchingIntegration = integrations.find((i) => i.stage === stage.id);
      if (matchingIntegration) {
        step.systemIntegration = {
          system: matchingIntegration.system,
          systemLabel: systemLabels[matchingIntegration.system],
          status: matchingIntegration.status,
          colorClass: systemColors[matchingIntegration.system],
        };
      }

      return step;
    });
  }, [request, history, integrations]);

  // Handle stepper click
  const handleStepClick = useCallback(
    (stepId: string) => {
      setExpandedStages((prev) => {
        const next = new Set(prev);
        next.add(stepId);
        return next;
      });
      setHighlightedStage(stepId);

      // Scroll to card
      requestAnimationFrame(() => {
        const el = cardRefs.current[stepId];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });

      // Clear highlight after a moment
      setTimeout(() => setHighlightedStage(null), 2000);
    },
    [],
  );

  const toggleStage = useCallback((stageId: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        next.add(stageId);
      }
      return next;
    });
  }, []);

  // Detail lookup by stage
  const getDetailForStage = (stageId: string) => {
    return stepDetails.find((d) => d.stage === stageId);
  };

  // Determine which stages to show cards for
  const visibleStages = LIFECYCLE_STAGES.map((stage) => {
    const entry = stageEntries.get(stage.id);
    const isStageCompleted = completedStages.has(stage.id);
    const isCurrent = request.status === stage.id;

    let cardStatus: 'completed' | 'current' | 'future' | 'skipped' | 'blocked';
    if (isCancelled) {
      cardStatus = isStageCompleted ? 'completed' : 'skipped';
    } else if (isCompleted) {
      cardStatus = 'completed';
    } else if (isCurrent) {
      cardStatus = request.isOverdue ? 'blocked' : 'current';
    } else if (request.status === 'referred-back' && entry && !entry.completedAt) {
      cardStatus = 'blocked';
    } else if (isStageCompleted) {
      cardStatus = 'completed';
    } else {
      cardStatus = 'future';
    }

    return {
      ...stage,
      status: cardStatus,
      entry,
      detail: getDetailForStage(stage.id),
    };
  });

  return (
    <div className="space-y-6">
      {/* Interactive Lifecycle Stepper */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current Workflow Position</CardTitle>
        </CardHeader>
        <CardContent>
          <ProcessStepper steps={steps} onStepClick={handleStepClick} />
        </CardContent>
      </Card>

      {/* Step Detail Panels + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {visibleStages.map((stage) => (
            <StepDetailCard
              key={stage.id}
              ref={(el) => {
                cardRefs.current[stage.id] = el;
              }}
              stage={stage.id}
              stageLabel={stage.label}
              status={stage.status}
              detail={stage.detail}
              stageHistory={stage.entry}
              isExpanded={expandedStages.has(stage.id)}
              onToggle={() => toggleStage(stage.id)}
              isHighlighted={highlightedStage === stage.id}
            />
          ))}
        </div>

        {/* Right sidebar */}
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
            <Button
              variant="outline"
              className="text-amber-700 border-amber-300 hover:bg-amber-50"
              onClick={() => setReferBackOpen(true)}
            >
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

      {/* System Integrations Timeline */}
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
