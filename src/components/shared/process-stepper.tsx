import { Check, AlertTriangle, RotateCcw, ArrowUpRight, HelpCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type StepStatus = 'completed' | 'current' | 'future' | 'skipped' | 'blocked';
type StepEvent = 'referred-back' | 'escalated' | 'info-requested' | 'overdue';

interface Step {
  id: string;
  label: string;
  status: StepStatus;
  date?: string;
  owner?: string;
  daysInStep?: number;
  systemIntegration?: {
    system: string;
    systemLabel: string;
    status: string;
    colorClass: string;
  };
  /** Visible markers rendered as badges on the step. Order preserved. */
  events?: StepEvent[];
}

const EVENT_STYLES: Record<StepEvent, { icon: typeof Check; color: string; title: string }> = {
  'referred-back':   { icon: RotateCcw,    color: 'text-amber-600',  title: 'Referred back' },
  'escalated':       { icon: ArrowUpRight, color: 'text-red-600',    title: 'Escalated' },
  'info-requested':  { icon: HelpCircle,   color: 'text-yellow-600', title: 'Info requested' },
  'overdue':         { icon: Clock,        color: 'text-red-600',    title: 'Overdue' },
};

interface ProcessStepperProps {
  steps: Step[];
  onStepClick?: (stepId: string) => void;
}

const integrationStatusLabels: Record<string, string> = {
  'pending-handover': 'Pending',
  'submitted': 'Submitted',
  'awaiting-response': 'Awaiting response',
  'processing': 'Processing',
  'completed': 'Completed',
  'error': 'Error',
  'timeout': 'Timeout',
};

const stepStyles: Record<StepStatus, { dot: string; line: string; label: string }> = {
  completed: {
    dot: 'bg-green-600 text-white',
    line: 'bg-green-600',
    label: 'text-green-700 font-medium',
  },
  current: {
    dot: 'bg-amber-500 text-white animate-pulse',
    line: 'bg-gray-300',
    label: 'text-amber-700 font-semibold',
  },
  future: {
    dot: 'border-2 border-gray-300 bg-white',
    line: 'bg-gray-300',
    label: 'text-gray-400',
  },
  skipped: {
    dot: 'border-2 border-dashed border-gray-300 bg-white',
    line: 'bg-gray-300',
    label: 'text-gray-400 line-through',
  },
  blocked: {
    dot: 'bg-red-600 text-white',
    line: 'bg-gray-300',
    label: 'text-red-700 font-medium',
  },
};

export function ProcessStepper({ steps, onStepClick }: ProcessStepperProps) {
  return (
    <div className="flex items-start w-full overflow-x-auto">
      {steps.map((step, index) => {
        const style = stepStyles[step.status];
        const isLast = index === steps.length - 1;

        return (
          <div
            key={step.id}
            className={cn('flex items-start flex-1 min-w-0', !isLast && 'flex-shrink-0')}
          >
            <div
              className={cn(
                'flex flex-col items-center',
                onStepClick && 'cursor-pointer'
              )}
              onClick={() => onStepClick?.(step.id)}
            >
              <div
                className={cn(
                  'flex size-7 items-center justify-center rounded-full text-xs shrink-0',
                  style.dot
                )}
              >
                {step.status === 'completed' && <Check className="size-4" />}
                {step.status === 'blocked' && <AlertTriangle className="size-3.5" />}
                {(step.status === 'current' || step.status === 'future' || step.status === 'skipped') && (
                  <span>{index + 1}</span>
                )}
              </div>
              <p className={cn('mt-1.5 text-xs text-center max-w-[80px] leading-tight', style.label)}>
                {step.label}
              </p>
              {step.date && (
                <p className="mt-0.5 text-[10px] text-muted-foreground">{step.date}</p>
              )}
              {step.daysInStep !== undefined && (
                <p className="text-[10px] text-muted-foreground">{step.daysInStep}d</p>
              )}
              {step.systemIntegration && (
                <div className={cn('mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium', step.systemIntegration.colorClass)}>
                  <span className="size-1.5 rounded-full bg-current" />
                  {step.systemIntegration.systemLabel}
                  <span className="opacity-70">— {integrationStatusLabels[step.systemIntegration.status] ?? step.systemIntegration.status}</span>
                </div>
              )}
              {step.events && step.events.length > 0 && (
                <div className="mt-1 flex items-center gap-1">
                  {step.events.map((ev) => {
                    const cfg = EVENT_STYLES[ev];
                    const Icon = cfg.icon;
                    return (
                      <span
                        key={ev}
                        className={cn('inline-flex items-center', cfg.color)}
                        title={cfg.title}
                      >
                        <Icon className="size-3" />
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            {!isLast && (
              <div className={cn('mt-3.5 h-0.5 flex-1 mx-1', style.line)} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export type { Step, StepStatus, StepEvent };
