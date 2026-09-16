// Loading the channel → stages map with a caller-supplied client.
//
// Mirrors tickets-core.ts and approvals-core.ts: the browser holds the
// /api/db singleton and the serverless handlers hold the privileged in-process
// one, and src/lib/db/* imports the '@/'-aliased client that Vercel cannot
// resolve at runtime. Relative '.js' specifiers only.
import type { NeonCompatibleClient } from '../neon-compatible-client.js';
import { channelStageMapFromTemplates, type ChannelStageMap } from '../workflow/channel-stages.js';

/**
 * Every template's channel claims and graph, as a stage map.
 *
 * An empty map is returned when the templates cannot be read, and every lookup
 * degrades to the full union rather than to a guess — the alternative is a
 * caller silently believing a channel skips a stage it traverses.
 */
export async function loadChannelStageMapWith(client: NeonCompatibleClient): Promise<ChannelStageMap> {
  const { data, error } = await client
    .from('workflow_templates')
    .select('id, channels, nodes, edges');
  if (error || !data) return {};
  return channelStageMapFromTemplates(data as unknown as Parameters<typeof channelStageMapFromTemplates>[0]);
}
