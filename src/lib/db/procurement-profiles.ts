// Profile defaults used by governed checkout. Keeping this separate from users
// allows accounting and approved delivery data to evolve without identity churn.
import { supabase } from '@/lib/supabase-client';
import type { ProcurementProfile } from '@/data/types';
import { mapDbToProcurementProfile, mapProcurementProfileToDb } from './mappers';

const TABLE = 'procurement_profiles';
const profileStoreEnabled =
  (import.meta.env.VITE_DATABASE_PROVIDER as string | undefined) === 'neon'
  || (import.meta.env.VITE_PROCUREMENT_PROFILES_ENABLED as string | undefined) === 'true';

export async function getProcurementProfile(userId: string): Promise<ProcurementProfile | null> {
  // Older Supabase deployments predate the additive profile table. Avoid a
  // noisy browser 404 and let checkout request only the fields it cannot infer
  // until the schema migration is enabled explicitly.
  if (!profileStoreEnabled) return null;
  const { data, error } = await supabase.from(TABLE).select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data ? mapDbToProcurementProfile(data) : null;
}

export async function upsertProcurementProfile(profile: ProcurementProfile): Promise<ProcurementProfile> {
  const { data, error } = await supabase.from(TABLE).upsert(mapProcurementProfileToDb(profile), { onConflict: 'user_id' }).select('*').single();
  if (error) throw error;
  return mapDbToProcurementProfile(data);
}
