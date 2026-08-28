// The "what am I looking at" panel at the top of each wizard step.
//
// Renders the guidance map in step-guidance.ts: what the step is for, what the
// requester has to supply, and what happens once they leave it. The third of
// those is the one that was missing everywhere — a requester could not tell,
// from any screen, that the pre-check settles the buying channel or that the
// description written on step 3 is reused all the way into contracting.

import { Info } from 'lucide-react';
import type { StepGuidance } from '../step-guidance';

interface StepHeaderPanelProps {
  guidance: StepGuidance | null;
  /** Rendered in place of the default "What happens next" line, when a step can say something more specific. */
  nextOverride?: string;
}

export function StepHeaderPanel({ guidance, nextOverride }: StepHeaderPanelProps) {
  if (!guidance) return null;

  return (
    <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50/40 p-4">
      <div className="flex items-start gap-2.5">
        <Info className="mt-0.5 size-4 shrink-0 text-[#2D5F8A]" />
        <div className="flex-1 space-y-2.5">
          <p className="text-sm text-gray-700">{guidance.purpose}</p>

          {guidance.youProvide.length > 0 && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                What we need from you
              </p>
              <ul className="mt-1 space-y-0.5">
                {guidance.youProvide.map((item) => (
                  <li key={item} className="flex gap-1.5 text-xs text-gray-600">
                    <span aria-hidden className="text-gray-400">·</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
              What happens next
            </p>
            <p className="mt-0.5 text-xs text-gray-600">{nextOverride ?? guidance.next}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
