// A horizontal process stepper — request lifecycle, PO progress, payment runs.
//
// Redesigned against four faults:
//   · The current step was amber and pulsed forever. Being in a stage is
//     normal progress, not a warning, and an endless animation ignored
//     reduced-motion. It is now the accent, held by a ring, and still.
//   · Steps were sized by their content, so a step with a wide integration chip
//     squeezed the connector after it to a dash. Every step is now an equal
//     grid column and every connector the same length.
//   · The detail lines were 10px — below the type scale's floor. They are
//     `text-eyebrow`, and date and days share one line.
//   · An integration's state was carried only by its chip's colour, so once
//     system chips went neutral "Timeout" and "Completed" looked alike. The
//     state now has its own tone on the dot and in words.
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
  /** For the current step only: what it is waiting for. */
  openAction?: string;
  systemIntegration?: {
    system: string;
    systemLabel: string;
    status: string;
  };
  /** Visible markers rendered as badges on the step. Order preserved. */
  events?: StepEvent[];
}

const EVENT_STYLES: Record<StepEvent, { icon: typeof Check; color: string; title: string }> = {
  'referred-back': { icon: RotateCcw, color: 'text-warn', title: 'Referred back' },
  escalated: { icon: ArrowUpRight, color: 'text-stop', title: 'Escalated' },
  'info-requested': { icon: HelpCircle, color: 'text-warn', title: 'Info requested' },
  overdue: { icon: Clock, color: 'text-stop', title: 'Overdue' },
};

interface ProcessStepperProps {
  steps: Step[];
  onStepClick?: (stepId: string) => void;
}

/** An upstream handover's state, in words and in a tone. */
const INTEGRATION_STATE: Record<string, { label: string; dot: string; text: string }> = {
  'pending-handover': { label: 'Pending handover', dot: 'bg-idle', text: 'text-ink-3' },
  submitted: { label: 'Submitted', dot: 'bg-warn', text: 'text-warn' },
  'awaiting-response': { label: 'Awaiting response', dot: 'bg-warn', text: 'text-warn' },
  processing: { label: 'Processing', dot: 'bg-warn', text: 'text-warn' },
  completed: { label: 'Completed', dot: 'bg-ok', text: 'text-ok' },
  error: { label: 'Failed', dot: 'bg-stop', text: 'text-stop' },
  timeout: { label: 'Timed out', dot: 'bg-stop', text: 'text-stop' },
};

const stepStyles: Record<StepStatus, { dot: string; line: string; label: string; word: string }> = {
  completed: { dot: 'bg-ok text-paper', line: 'bg-ok', label: 'text-ink-2', word: 'completed' },
  current: {
    dot: 'bg-accent-solid text-paper ring-4 ring-accent-soft',
    line: 'bg-line',
    label: 'text-ink font-semibold',
    word: 'current stage',
  },
  future: { dot: 'border-2 border-line bg-card text-ink-3', line: 'bg-line', label: 'text-ink-3', word: 'not started' },
  skipped: {
    dot: 'border-2 border-dashed border-line bg-card text-ink-3',
    line: 'bg-line',
    label: 'text-ink-3 line-through',
    word: 'skipped for this buying channel',
  },
  blocked: { dot: 'bg-stop text-paper ring-4 ring-stop-soft', line: 'bg-line', label: 'text-stop font-semibold', word: 'blocked' },
};

export function ProcessStepper({ steps, onStepClick }: ProcessStepperProps) {
  return (
    <div className="w-full overflow-x-auto">
      <ol
        className="grid min-w-[640px]"
        style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      >
        {steps.map((step, index) => {
          const style = stepStyles[step.status];
          const isLast = index === steps.length - 1;
          const integration = step.systemIntegration
            ? INTEGRATION_STATE[step.systemIntegration.status]
              ?? { label: step.systemIntegration.status, dot: 'bg-idle', text: 'text-ink-3' }
            : null;

          return (
            <li key={step.id} className="relative flex flex-col items-center px-1">
              {/* Centre of this dot to centre of the next: the dots are opaque
                  and sit above it, so each connector is exactly one column. */}
              {!isLast && (
                <span aria-hidden="true" className={cn('absolute left-1/2 top-3.5 h-0.5 w-full', style.line)} />
              )}
              <button
                type="button"
                className={cn(
                  'relative flex w-full flex-col items-center rounded-md border-0 bg-transparent p-0 text-center',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-solid',
                  onStepClick ? 'cursor-pointer' : 'cursor-default',
                )}
                aria-label={`${step.label}: ${style.word}`}
                disabled={!onStepClick}
                onClick={() => onStepClick?.(step.id)}
              >
                <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full text-caption tabular-nums', style.dot)}>
                  {step.status === 'completed' && <Check className="size-4" aria-hidden="true" />}
                  {step.status === 'blocked' && <AlertTriangle className="size-3.5" aria-hidden="true" />}
                  {(step.status === 'current' || step.status === 'future' || step.status === 'skipped') && index + 1}
                </span>
                <span className={cn('mt-2 line-clamp-2 text-caption leading-tight', style.label)}>{step.label}</span>
                {(step.date || step.daysInStep !== undefined) && (
                  <span className="mt-0.5 text-eyebrow tabular-nums text-ink-3">
                    {[step.date, step.daysInStep !== undefined ? `${step.daysInStep}d` : null].filter(Boolean).join(' · ')}
                  </span>
                )}
                {/* `owner` has been on the Step type since this component was
                    written and was never rendered, so "who owns this stage" was
                    invisible even when the data was there. */}
                {step.owner && (
                  <span className="w-full truncate text-eyebrow text-ink-3" title={step.owner}>{step.owner}</span>
                )}
                {step.openAction && (
                  <span className="mt-0.5 text-eyebrow font-medium leading-tight text-accent">{step.openAction}</span>
                )}
                {step.systemIntegration && integration && (
                  <span
                    className="mt-1.5 flex max-w-full flex-col items-center rounded-md border border-line bg-card-2 px-1.5 py-0.5"
                    title={`${step.systemIntegration.systemLabel}: ${integration.label}`}
                  >
                    <span className="flex max-w-full items-center gap-1 text-eyebrow text-ink-2">
                      <span className={cn('size-1.5 shrink-0 rounded-full', integration.dot)} aria-hidden="true" />
                      <span className="truncate">{step.systemIntegration.systemLabel}</span>
                    </span>
                    <span className={cn('text-eyebrow font-medium', integration.text)}>{integration.label}</span>
                  </span>
                )}
                {step.events && step.events.length > 0 && (
                  <span className="mt-1 flex items-center gap-1">
                    {step.events.map((ev) => {
                      const cfg = EVENT_STYLES[ev];
                      const Icon = cfg.icon;
                      return (
                        <span key={ev} className={cn('inline-flex items-center', cfg.color)} title={cfg.title}>
                          <Icon className="size-3" aria-hidden="true" />
                          <span className="sr-only">{cfg.title}</span>
                        </span>
                      );
                    })}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export type { Step, StepStatus, StepEvent };
