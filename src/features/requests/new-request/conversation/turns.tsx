// The conversation page's transcript pieces (Intake Prototype): the assistant's
// turns, the requester's, the phase labels between them, and the buttons a
// turn is answered with. Presentation only — what is said is the page's.
import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** "1 · What you need" — where the conversation is, between its turns. */
export function PhaseLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-2" role="separator" aria-label={typeof children === 'string' ? children : undefined}>
      <span className="text-eyebrow font-semibold uppercase tracking-[0.08em] text-ink-3">{children}</span>
      <span className="h-px flex-1 bg-line-2" />
    </div>
  );
}

/**
 * A reason as the tail of "Asked because …". The configured slot reasons are
 * written as whole sentences that already open with those words; a risk
 * question's reason is a bare clause ("Material spend").
 */
function reason(why: string): string {
  const clause = why.replace(/^asked because\s+/i, '');
  return `${clause.charAt(0).toLowerCase()}${clause.slice(1)}`;
}

export function AssistantTurn({ children, why, example, note, className }: {
  children: ReactNode;
  /** The "asked because…" line for a conditional question. */
  why?: string;
  /** A worked example, as a hint under the question rather than glued onto it. */
  example?: string;
  /** A quiet line of provenance — who or what produced the answer above. */
  note?: string;
  className?: string;
}) {
  return (
    <div className={cn('max-w-[88%] self-start rounded-lg rounded-tl-sm border border-line bg-card px-3.5 py-2.5 text-body leading-relaxed text-ink', className)} data-turn="assistant">
      <div className="whitespace-pre-line">{children}</div>
      {example && <p className="mt-1 text-caption text-ink-3">For example: {example}</p>}
      {why && <p className="mt-1 text-caption text-ink-3">Asked because {reason(why)}</p>}
      {note && <p className="mt-1 text-caption text-ink-3">{note}</p>}
    </div>
  );
}

export function UserTurn({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-[80%] self-end whitespace-pre-line rounded-lg rounded-tr-sm bg-accent-solid px-3.5 py-2 text-body leading-relaxed text-paper" data-turn="user">
      {children}
    </div>
  );
}

/** A card the requester acts on — a route, a supplier question, "channel confirmed". */
export function CardTurn({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'ok' }) {
  return (
    <div
      className={cn(
        'flex max-w-[92%] flex-col gap-2.5 self-start rounded-lg border px-3.5 py-3 text-body leading-relaxed',
        tone === 'ok' ? 'border-ok-line bg-ok-soft/60' : tone === 'accent' ? 'border-accent-line bg-accent-soft/50' : 'border-line bg-card',
      )}
      data-turn="card"
    >
      {children}
    </div>
  );
}

export function Working({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 self-start text-caption text-ink-3" role="status">
      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> {children}
    </p>
  );
}

/** The buttons a turn is answered with. Disabled once answered, so the history reads as it happened. */
export function Choices({ options, disabled }: {
  options: Array<{ label: string; onClick: () => void; primary?: boolean }>;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Button
          key={option.label}
          size="sm"
          variant={option.primary ? 'default' : 'outline'}
          className="h-8 text-caption"
          disabled={disabled}
          onClick={option.onClick}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
