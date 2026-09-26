// "Marking this urgent changes where it goes" — shown with the Urgent toggle in
// the conversation page's Your request panel.
//
// The buying channel is settled in the conversation, and one thing the
// requester sets can still move it: a rule keyed on urgency. The change is made
// VISIBLE and user-caused at the toggle, so nothing about the channel changes
// silently.
//
// Derived from the live rule set, not hardcoded: today RR-010 ("Urgent request
// fast-track") only ever escalates to procurement-led, but an admin can write a
// rule that does something else, and this must say what the rules actually do.

import { AlertTriangle } from 'lucide-react';
import { useRoutingRules } from '@/lib/db/hooks/use-routing-rules';
import { buyingChannelLabel } from '@/lib/routing/evaluate-routing-rules';
import { urgencyWouldChangeChannel } from '@/lib/routing/demand-channel';
import { usePolicyConfig } from '@/lib/procurement/use-policy-config';

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
  const policyConfig = usePolicyConfig();

  // Risk rating and materiality are deliberately not passed: this compares the
  // same demand with urgency on and off, so any field held constant across both
  // sides cancels out. Passing a preliminary read here would add a way for the
  // note to disagree with the pre-check without changing what it says.
  const change = urgencyWouldChangeChannel(routingRules, {
    category,
    value: estimatedValue,
    supplierId,
    // Held constant on both sides of the comparison, so they cancel out. Named
    // explicitly because DemandChannelInput requires every key — an omission
    // here is what let the buy-route step silently drop urgency.
    contractId: undefined,
    isUrgent: undefined,
    riskRating: undefined,
    material: undefined,
    supplierRiskRating: undefined,
    commodityCode: undefined,
  }, policyConfig);

  // Silent when urgency changes nothing — a warning that is always on is one
  // nobody reads.
  if (!change) return null;

  return (
    <p className="flex items-start gap-1.5 text-[11px] text-warn">
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
