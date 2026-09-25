// A policy question answered from the configuration: the direct answer when the
// thresholds decide it, the knowledge-base entry that states the rule, and
// where both come from. One view for the Home box and the assistant, which
// showed the same answer two ways.
import type { PolicyAnswer } from '@/lib/assistant/policy-lookup';

export function PolicyAnswerView({ answer }: { answer: PolicyAnswer }) {
  const { direct, entry } = answer;
  return (
    <div className="space-y-2">
      {direct && <p className="text-sm font-medium text-ink">{direct.answer}</p>}
      {entry && (
        direct ? (
          <details className="text-sm text-ink-2">
            <summary className="cursor-pointer text-xs font-medium text-accent">The rule in full — {entry.title}</summary>
            <p className="mt-1.5 whitespace-pre-wrap leading-relaxed">{entry.text}</p>
          </details>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-2">{entry.text}</p>
        )
      )}
      <p className="text-[11px] text-ink-3">
        From: {[direct?.source, entry && `${entry.title}${entry.source ? ` (${entry.source})` : ''}`].filter(Boolean).join(' · ')}
      </p>
    </div>
  );
}
