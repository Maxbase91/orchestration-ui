import { db } from '@/lib/db-client';
import type { SystemIntegration } from '@/data/system-integrations';
import { mapDbToSystemIntegration, mapSystemIntegrationToDb } from './mappers';

const TABLE = 'system_integrations';

export async function listSystemIntegrations(): Promise<SystemIntegration[]> {
  const { data, error } = await db.from(TABLE).select('*');
  if (error) throw error;
  return (data ?? []).map(mapDbToSystemIntegration);
}

export async function listIntegrationsByRequest(requestId: string): Promise<SystemIntegration[]> {
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .eq('request_id', requestId);
  if (error) throw error;
  return (data ?? []).map(mapDbToSystemIntegration);
}

export async function upsertSystemIntegration(record: SystemIntegration): Promise<SystemIntegration> {
  const { data, error } = await db
    .from(TABLE)
    .upsert(mapSystemIntegrationToDb(record), { onConflict: 'id' })
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToSystemIntegration(data);
}
