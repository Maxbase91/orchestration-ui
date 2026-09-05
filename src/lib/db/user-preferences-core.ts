// The user-preferences read/merge both the browser and the serverless handlers
// need. Same reason as tickets-core.ts: src/lib/db/user-preferences.ts imports
// the '@/'-aliased browser client, which Vercel cannot resolve at runtime, so
// api/chat.ts had grown a second read-merge-upsert against the same table.
import type { NeonCompatibleClient } from '../neon-compatible-client.js';

const TABLE = 'user_preferences';

export interface UserPrefs {
  currency?: string;
  notifications?: Record<string, unknown>;
  [key: string]: unknown;
}

export async function readPreferences(client: NeonCompatibleClient, userId: string): Promise<UserPrefs> {
  const { data, error } = await client
    .from(TABLE)
    .select('prefs')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.prefs as UserPrefs) ?? {};
}

/** Merge a patch into the stored preferences rather than replacing them. */
export async function mergePreferences(
  client: NeonCompatibleClient,
  userId: string,
  patch: Partial<UserPrefs>,
): Promise<UserPrefs> {
  const existing = await readPreferences(client, userId);
  const merged = { ...existing, ...patch };
  const { data, error } = await client
    .from(TABLE)
    .upsert(
      { user_id: userId, prefs: merged, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
    .select('prefs')
    .single();
  if (error) throw error;
  return (data.prefs as UserPrefs) ?? merged;
}
