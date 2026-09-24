// The channel → stages map, derived from the workflow templates.
//
// Mirrors use-stage-slas.ts, and for the same reason: the templates own the
// lifecycle, so anything asking "which stages does this channel visit" derives
// it rather than restating it. `buying-channel-stages.ts` was that restatement
// and it disagreed with the templates for every channel.
import { useMemo } from 'react';
import { channelCopy, channelStageMapFromTemplates, type ChannelStageMap } from '@/lib/workflow/channel-stages';
import { buyingChannelLabel } from '@/lib/routing/evaluate-routing-rules';
import type { BuyingChannel } from '@/data/types';
import { useWorkflowTemplates } from './use-workflow-templates';

export function useChannelStageMap(): { data: ChannelStageMap; isLoading: boolean } {
  const { data: templates = [], isLoading } = useWorkflowTemplates();
  const data = useMemo(() => channelStageMapFromTemplates(templates), [templates]);
  return { data, isLoading };
}

/**
 * The requester's wording for a channel, from the template that claims it.
 * Returns a function so a screen can ask about several channels at once.
 */
export function useChannelCopy(): (channel: string) => { headline: string; detail: string } {
  const { data: templates = [] } = useWorkflowTemplates();
  return useMemo(
    () => (channel: string) => channelCopy(templates, channel, buyingChannelLabel(channel as BuyingChannel)),
    [templates],
  );
}
