import { ProcessStepper, type Step } from '@/components/shared/process-stepper';
import type { ProcurementRequest, RequestStatus, StageHistoryEntry } from '@/data/types';
import { useStageHistoryByRequest } from '@/lib/db/hooks/use-stage-history';
import { useUserLookup, useUsers } from '@/lib/db/hooks/use-users';
import { formatDate } from '@/lib/format';
import { useIntegrationsByRequest } from '@/lib/db/hooks/use-system-integrations';
import { systemLabels, systemColors } from '@/data/system-integrations';

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

interface LifecycleStepperProps {
  request: ProcurementRequest;
}

export function LifecycleStepper({ request }: LifecycleStepperProps) {
  useUsers();
  const lookupUser = useUserLookup();
  const { data: history = [] } = useStageHistoryByRequest(request.id);
  const { data: integrations = [] } = useIntegrationsByRequest(request.id);

  const completedStages = new Set<string>();
  const stageEntries = new Map<string, StageHistoryEntry>();

  for (const entry of history) {
    if (entry.stage === 'draft' || entry.stage === 'referred-back' || entry.stage === 'completed') continue;
    if (entry.completedAt) {
      completedStages.add(entry.stage);
    }
    // Keep the latest entry for each stage
    stageEntries.set(entry.stage, entry);
  }

  const isCancelled = request.status === 'cancelled';
  const isCompleted = request.status === 'completed';

  const steps: Step[] = LIFECYCLE_STAGES.map((stage) => {
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

    const owner = entry ? lookupUser(entry.ownerId) : undefined;
    const daysInStep = entry ? getDaysInStep(entry) : undefined;

    return {
      id: stage.id,
      label: stage.label,
      status,
      date: entry ? formatDate(entry.enteredAt) : undefined,
      owner: owner?.name,
      daysInStep,
    };
  });

  // Attach system integration info to matching steps
  for (const integration of integrations) {
    const matchingStep = steps.find((s) => s.id === integration.stage);
    if (matchingStep) {
      matchingStep.systemIntegration = {
        system: integration.system,
        systemLabel: systemLabels[integration.system],
        status: integration.status,
        colorClass: systemColors[integration.system],
      };
    }
  }

  return <ProcessStepper steps={steps} />;
}
