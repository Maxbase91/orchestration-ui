// The channel → stages map, derived from the workflow templates.
//
// Mirrors use-stage-slas.ts, and for the same reason: the templates own the
// lifecycle, so anything asking "which stages does this channel visit" derives
// it rather than restating it. `buying-channel-stages.ts` was that restatement
// and it disagreed with the templates for every channel.
import { useMemo } from 'react';
import { channelStageMapFromTemplates, type ChannelStageMap } from '@/lib/workflow/channel-stages';
import { useWorkflowTemplates } from './use-workflow-templates';

export function useChannelStageMap(): { data: ChannelStageMap; isLoading: boolean } {
  const { data: templates = [], isLoading } = useWorkflowTemplates();
  const data = useMemo(() => channelStageMapFromTemplates(templates), [templates]);
  return { data, isLoading };
}
