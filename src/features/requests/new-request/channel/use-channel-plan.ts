// The channel's template, its requester wording and the plan for this request —
// what the Channel page draws, for a full request and a call-off alike.
//
// The wrappers pass in the landing and the signals, each from the rule its
// writer uses (they read the channel's stage map themselves, because the intake
// landing is computed from it). This finds the template that claims the
// channel, with the same "first claim wins" rule submit applies, and runs the
// plan over it.
import { useMemo } from 'react';
import type { BuyingChannel } from '@/data/types';
import { useWorkflowTemplates } from '@/lib/db/hooks/use-workflow-templates';
import { usePolicyConfig } from '@/lib/procurement/use-policy-config';
import { buyingChannelLabel } from '@/lib/routing/evaluate-routing-rules';
import { channelCopy, templateForChannel } from '@/lib/workflow/channel-stages';
import { planChannel, type PlanInput, type PlanTemplate } from '@/lib/workflow/channel-plan';

export function useChannelPlan(channel: BuyingChannel, input: PlanInput | null) {
  const { data: templates = [], isLoading } = useWorkflowTemplates();
  const config = usePolicyConfig();
  const template = useMemo(
    () => templates.find((t) => t.id === templateForChannel(templates, channel)) ?? null,
    [templates, channel],
  );
  const plan = useMemo(
    () => (template && input ? planChannel(template as PlanTemplate, input, config) : null),
    [template, input, config],
  );
  const copy = useMemo(
    () => channelCopy(templates, channel, buyingChannelLabel(channel)),
    [templates, channel],
  );
  return { template, plan, copy, config, isLoading };
}
