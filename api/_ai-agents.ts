// Server-side helper for reading AI agent config from Supabase.
// Imported by api/ai.ts, api/chat-intake.ts, etc. so every LLM-backed
// endpoint reflects the admin's edits without a redeploy.
//
// Result is memoised for 60 seconds to avoid hitting the DB on every
// invocation; the cache is process-local and resets on Vercel cold-start.

import { supabaseAdmin } from './_supabase-admin.js';

export interface AgentRecord {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'draft' | 'disabled';
  description: string;
  accuracy: number;
  lastUpdated: string | null;
}

interface CacheEntry {
  value: AgentRecord | null;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

export async function getAgent(id: string): Promise<AgentRecord | null> {
  const hit = cache.get(id);
  const now = Date.now();
  if (hit && hit.expiresAt > now) return hit.value;

  const { data, error } = await supabaseAdmin
    .from('ai_agents')
    .select('id,name,type,status,description,accuracy,last_updated')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    // Fail open: log and return null so the caller falls back to defaults.
    console.error(`getAgent(${id}) error:`, error.message);
    cache.set(id, { value: null, expiresAt: now + CACHE_TTL_MS });
    return null;
  }

  const value: AgentRecord | null = data
    ? {
        id: data.id,
        name: data.name,
        type: data.type,
        status: data.status,
        description: data.description ?? '',
        accuracy: data.accuracy ?? 0,
        lastUpdated: data.last_updated ?? null,
      }
    : null;
  cache.set(id, { value, expiresAt: now + CACHE_TTL_MS });
  return value;
}

export function isAgentActive(agent: AgentRecord | null): boolean {
  return agent?.status === 'active';
}
