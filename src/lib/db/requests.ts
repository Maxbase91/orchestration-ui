import { supabase } from '@/lib/supabase-client';
import type { ProcurementRequest } from '@/data/types';
import { mapDbToRequest, mapRequestToDb } from './mappers';

const TABLE = 'requests';

export async function listRequests(): Promise<ProcurementRequest[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapDbToRequest);
}

export async function getRequest(id: string): Promise<ProcurementRequest | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapDbToRequest(data) : null;
}

export async function createRequest(record: Partial<ProcurementRequest>): Promise<ProcurementRequest> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(mapRequestToDb(record))
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToRequest(data);
}

export async function updateRequest(
  id: string,
  patch: Partial<ProcurementRequest>,
): Promise<ProcurementRequest> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(mapRequestToDb(patch))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToRequest(data);
}

export async function deleteRequest(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
