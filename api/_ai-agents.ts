// Server-side helper for reading AI agent config from the database.
// Imported by api/ai.ts, api/chat-intake.ts, etc. so every LLM-backed
// endpoint reflects the admin's edits without a redeploy.
//
// Result is memoised for 60 seconds to avoid hitting the DB on every
// invocation; the cache is process-local and resets on Vercel cold-start.

import { getDbAdmin } from './_db-admin.js';

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

  const { data, error } = await getDbAdmin()
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

  // Coerced rather than assumed: a database row is untyped values, and the
  // client no longer pretends otherwise. `status` in particular narrows to the
  // three the record allows, so an unexpected value from the table reads as
  // 'disabled' instead of flowing through as an active agent.
  const status = String(data?.status ?? '');
  const value: AgentRecord | null = data
    ? {
        id: String(data.id),
        name: String(data.name),
        type: String(data.type),
        status: status === 'active' || status === 'draft' ? status : 'disabled',
        description: data.description == null ? '' : String(data.description),
        accuracy: Number(data.accuracy ?? 0),
        lastUpdated: data.last_updated == null ? null : String(data.last_updated),
      }
    : null;
  cache.set(id, { value, expiresAt: now + CACHE_TTL_MS });
  return value;
}

// Deliberately not a type predicate: `false` covers both "no agent" and
// "agent present but disabled", and callers render a different message for each.
// A predicate would narrow the disabled case to `never` and hide that branch.
export function isAgentActive(agent: AgentRecord | null): boolean {
  return agent?.status === 'active';
}
