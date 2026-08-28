// "Marking this urgent changes where it goes" — shown as the toggle is ticked.
//
// The buying channel is settled on the pre-check (step 2) and shown there. One
// thing can still move it afterwards: a rule keyed on urgency, which is set on
// step 3. Rather than relocate the urgency control — it belongs with the other
// commercial facts — the change is made VISIBLE and user-caused. Nothing about
// the channel changes silently, which is the property actually wanted.
//
// Derived from the live rule set, not hardcoded: today RR-010 ("Urgent request
// fast-track") only ever escalates to procurement-led, but an admin can write a
// rule that does something else, and this must say what the rules actually do.

import { AlertTriangle } from 'lucide-react';
import { useRoutingRules } from '@/lib/db/hooks/use-routing-rules';
import { buyingChannelLabel } from '@/lib/routing/evaluate-routing-rules';
import { urgencyWouldChangeChannel } from '@/lib/routing/demand-channel';

interface UrgencyChannelNoteProps {
  category: string;
  estimatedValue: number;
  supplierId?: string;
  /** Whether the requester has ticked the toggle — changes tense, not content. */
  isUrgent: boolean;
}

export function UrgencyChannelNote({
  category, estimatedValue, supplierId, isUrgent,
}: UrgencyChannelNoteProps) {
  const { data: routingRules = [] } = useRoutingRules();

  // Risk rating and materiality are deliberately not passed: this compares the
  // same demand with urgency on and off, so any field held constant across both
  // sides cancels out. Passing a preliminary read here would add a way for the
  // note to disagree with the pre-check without changing what it says.
  const change = urgencyWouldChangeChannel(routingRules, {
    category,
    value: estimatedValue,
    supplierId,
  });

  // Silent when urgency changes nothing — a warning that is always on is one
  // nobody reads.
  if (!change) return null;

  return (
    <p className="flex items-start gap-1.5 text-[11px] text-amber-700">
      <AlertTriangle className="mt-px size-3 shrink-0" />
      <span>
        {isUrgent ? 'Marked urgent, so this request now goes to ' : 'Marking this urgent moves it to '}
        <strong className="font-medium">{buyingChannelLabel(change.to)}</strong>
        {' instead of '}
        {buyingChannelLabel(change.from)}.
      </span>
    </p>
  );
}
