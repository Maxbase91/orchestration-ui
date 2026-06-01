import { supabase } from '@/lib/supabase-client';

const TABLE = 'user_preferences';

export interface UserPrefs {
  currency?: string;
  notifications?: Record<string, unknown>;
  [key: string]: unknown;
}

export async function getUserPreferences(userId: string): Promise<UserPrefs> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('prefs')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.prefs as UserPrefs) ?? {};
}

export async function updateUserPreferences(
  userId: string,
  patch: Partial<UserPrefs>,
): Promise<UserPrefs> {
  // Read existing prefs first so we merge rather than overwrite
  const existing = await getUserPreferences(userId);
  const merged = { ...existing, ...patch };

  const { data, error } = await supabase
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
