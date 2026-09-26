import { db } from '@/lib/db-client';
import type { AIAgent } from '@/data/types';
import { mapDbToAiAgent, mapAiAgentToDb } from './mappers';
import { getAiAgentWith } from './ai-agents-core';

const TABLE = 'ai_agents';

export async function listAiAgents(): Promise<AIAgent[]> {
  const { data, error } = await db.from(TABLE).select('*').order('name');
  if (error) throw error;
  return (data ?? []).map(mapDbToAiAgent);
}

/** Through ai-agents-core.ts, the read submit's second decision runs too. */
export async function getAiAgent(id: string): Promise<AIAgent | null> {
  return getAiAgentWith(db, id);
}

export async function saveAiAgent(record: AIAgent): Promise<AIAgent> {
  const { data, error } = await db
    .from(TABLE)
    .upsert(mapAiAgentToDb(record), { onConflict: 'id' })
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToAiAgent(data);
}

export async function deleteAiAgent(id: string): Promise<void> {
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
