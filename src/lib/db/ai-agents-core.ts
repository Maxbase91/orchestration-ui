// Reading one AI agent with a given client, uncached. Submit's second decision
// reads the Request Validator (AI-002) here rather than through
// api/_ai-agents.ts, whose 60-second memo could hold a status the admin has
// just changed — and a stale status would refuse every submit until it
// expired. Relative '.js' specifiers only: api/ imports this.
import type { NeonCompatibleClient } from '../neon-compatible-client.js';
import type { AIAgent } from '../../data/types.js';
import { mapDbToAiAgent } from './mappers.js';

export async function getAiAgentWith(client: NeonCompatibleClient, id: string): Promise<AIAgent | null> {
  const { data, error } = await client.from('ai_agents').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapDbToAiAgent(data) : null;
}
