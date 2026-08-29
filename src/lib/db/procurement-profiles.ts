// Profile defaults used by governed checkout. Keeping this separate from users
// allows accounting and approved delivery data to evolve without identity churn.
import { supabase } from '@/lib/supabase-client';
import type { ProcurementProfile } from '@/data/types';
import { mapDbToProcurementProfile, mapProcurementProfileToDb } from './mappers';

const TABLE = 'procurement_profiles';

export async function getProcurementProfile(userId: string): Promise<ProcurementProfile | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data ? mapDbToProcurementProfile(data) : null;
}

export async function upsertProcurementProfile(profile: ProcurementProfile): Promise<ProcurementProfile> {
  const { data, error } = await supabase.from(TABLE).upsert(mapProcurementProfileToDb(profile), { onConflict: 'user_id' }).select('*').single();
  if (error) throw error;
  return mapDbToProcurementProfile(data);
}
