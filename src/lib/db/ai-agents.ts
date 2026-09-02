import { db } from '@/lib/db-client';
import type { AIAgent } from '@/data/types';
import { mapDbToAiAgent, mapAiAgentToDb } from './mappers';

const TABLE = 'ai_agents';

export async function listAiAgents(): Promise<AIAgent[]> {
  const { data, error } = await db.from(TABLE).select('*').order('name');
  if (error) throw error;
  return (data ?? []).map(mapDbToAiAgent);
}

export async function getAiAgent(id: string): Promise<AIAgent | null> {
  const { data, error } = await db.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapDbToAiAgent(data) : null;
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
