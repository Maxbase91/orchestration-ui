import { Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type StepStatus = 'completed' | 'current' | 'future' | 'skipped' | 'blocked';

interface Step {
  id: string;
  label: string;
  status: StepStatus;
  date?: string;
  owner?: string;
  daysInStep?: number;
}

interface ProcessStepperProps {
  steps: Step[];
  onStepClick?: (stepId: string) => void;
}

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

export type { Step, StepStatus };
