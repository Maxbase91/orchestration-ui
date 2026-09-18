// The "what am I looking at" panel at the top of each wizard step.
//
// Renders the guidance map in step-guidance.ts. It used to render all three
// parts at once — purpose, what you supply, what happens next — which on step 1
// meant the same instruction appeared four times before the single input: once
// in the stepper, once in the step heading, once here as `purpose`, and once as
// the input's own helper text. Roughly ninety words of chrome above one box.
//
// So it leads with the one part nothing else says: the **consequence**. A
// requester cannot tell from any other element that the pre-check settles the
// buying channel, or that the description written on step 3 is reused all the
// way into contracting. Purpose and the supply list are a disclosure — still
// one click away on a step where they help, not occupying the screen on the
// steps where the fields already say it.

import { useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StepGuidance } from '../intake-steps';

interface StepHeaderPanelProps {
  guidance: StepGuidance | null;
  /** Rendered in place of the default "What happens next" line, when a step can say something more specific. */
  nextOverride?: string;
}

export function StepHeaderPanel({ guidance, nextOverride }: StepHeaderPanelProps) {
  const [open, setOpen] = useState(false);
  if (!guidance) return null;

  return (
    <div className="mb-5 rounded-lg border border-accent-line bg-accent-soft/40 px-4 py-3">
      <div className="flex items-start gap-2.5">
        <Info className="mt-0.5 size-4 shrink-0 text-[#2D5F8A]" />
        <div className="min-w-0 flex-1">
          {/* A step with nothing worth saying about what comes next says
              nothing, rather than spending a line of the panel on it. */}
          {(nextOverride ?? guidance.next) && (
            <p className="text-sm text-ink-2">{nextOverride ?? guidance.next}</p>
          )}

          {open && (
            <div className="mt-2.5 space-y-2 border-t border-accent-line pt-2.5">
              <p className="text-xs text-ink-2">{guidance.purpose}</p>
              {guidance.youProvide.length > 0 && (
                <ul className="space-y-0.5">
                  {guidance.youProvide.map((item) => (
                    <li key={item} className="flex gap-1.5 text-xs text-ink-2">
                      <span aria-hidden className="text-ink-3">·</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((previous) => !previous)}
          className="shrink-0 rounded px-1.5 py-0.5 text-xs text-[#2D5F8A] hover:bg-accent-soft/60"
          aria-expanded={open}
        >
          <span className="flex items-center gap-1">
            {open ? 'Less' : 'What you need'}
            <ChevronDown className={cn('size-3 transition-transform', open && 'rotate-180')} />
          </span>
        </button>
      </div>
    </div>
  );
}
